import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import io
import base64
import os
from dotenv import load_dotenv, find_dotenv
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage, SystemMessage

# --- データ型自動変換 ---
def preprocess_df(df):
    # 日付型変換
    for col in df.columns:
        if any(x in col for x in ["日", "date", "日時", "誕生日"]):
            try:
                df[col] = pd.to_datetime(df[col], errors="coerce")
            except Exception:
                pass
    # 数値型変換
    for col in df.select_dtypes(include=[object]).columns:
        try:
            df[col] = pd.to_numeric(df[col], errors="ignore")
        except Exception:
            pass
    return df

# 柔軟な前処理（型ごとに処理）
def flexible_preprocess(df):
    import pandas as pd
    import numpy as np
    from datetime import datetime
    df = preprocess_df(df)
    feature_cols = []
    for col in df.columns:
        col_data = df[col]
        # 全欠損は除外
        if col_data.isnull().all():
            continue
        # 数値型
        if pd.api.types.is_numeric_dtype(col_data):
            feature_cols.append(col)
        # 日付型
        elif pd.api.types.is_datetime64_any_dtype(col_data):
            # 年齢や曜日などに変換
            if "誕" in col or "birth" in col.lower():
                df[f"{col}_年齢"] = col_data.apply(lambda x: (datetime.now() - x).days // 365 if pd.notnull(x) else np.nan)
                feature_cols.append(f"{col}_年齢")
            else:
                df[f"{col}_年"] = col_data.dt.year
                df[f"{col}_月"] = col_data.dt.month
                df[f"{col}_日"] = col_data.dt.day
                feature_cols += [f"{col}_年", f"{col}_月", f"{col}_日"]
        # カテゴリ/文字列型
        elif pd.api.types.is_string_dtype(col_data) or pd.api.types.is_categorical_dtype(col_data):
            # ユニーク値が少なければワンホット
            if col_data.nunique() < 20:
                dummies = pd.get_dummies(col_data, prefix=col, dummy_na=True)
                df = pd.concat([df, dummies], axis=1)
                feature_cols += list(dummies.columns)
            # それ以外は除外
    # 最終的な特徴量のみ抽出
    df = df[feature_cols]
    # NaN補完
    df = df.fillna(df.mean(numeric_only=True))
    return df

# --- 特徴量作成 ---
def create_features(df):
    # 年齢
    if "誕生日" in df.columns:
        df["年齢"] = df["誕生日"].apply(lambda x: (datetime.now() - x).days // 365 if pd.notnull(x) else np.nan)
    # 性別
    if "性別区分" in df.columns:
        df["性別"] = df["性別区分"].apply(lambda x: "男性" if isinstance(x, str) and ("1:男性" in x or "男" in x) else "女性")
    # 曜日
    if "曜日8" in df.columns:
        weekday_map = {'月':0, '火':1, '水':2, '木':3, '金':4, '土':5, '日':6, '祝':7}
        df["曜日数値"] = df["曜日8"].map(weekday_map)
    return df

# --- 集約 ---
def aggregate_features(df):
    def safe_mode(series):
        try:
            return series.mode().iloc[0]
        except:
            return -1
    agg_df = df.groupby("会員番号").agg({
        "利用金額": ["count", "sum", "mean", "max"],
        "曜日数値": safe_mode if "曜日数値" in df.columns else 'first',
        "性別": safe_mode if "性別" in df.columns else 'first',
        "年齢": "mean" if "年齢" in df.columns else 'first',
        "利用日時": (lambda x: safe_mode(x.dt.hour)) if "利用日時" in df.columns else 'first'
    }).reset_index()
    # カラム名整形
    agg_df.columns = ["会員番号", "回数", "合計金額", "平均金額", "最大金額", "最頻曜日", "性別", "年齢", "最頻時間帯"][:agg_df.shape[1]]
    # 性別ワンホット
    if "性別" in agg_df.columns:
        agg_df = pd.get_dummies(agg_df, columns=["性別"], drop_first=True)
    # NaN補完
    agg_df.fillna(agg_df.mean(numeric_only=True), inplace=True)
    return agg_df

# --- クラスタリング ---
def run_kmeans(agg_df, n_clusters=4):
    features = [c for c in ["回数", "合計金額", "平均金額", "最大金額", "最頻曜日", "年齢", "最頻時間帯"] if c in agg_df.columns]
    if "性別_男性" in agg_df.columns:
        features.append("性別_男性")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(agg_df[features])
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
    agg_df["クラスタ"] = kmeans.fit_predict(X_scaled)
    return agg_df, features

# --- LLMでクラスタ名付け ---
def name_clusters(agg_df, features):
    load_dotenv(find_dotenv("../.env"))
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    llm = ChatOpenAI(model="gpt-4", temperature=0.7, openai_api_key=OPENAI_API_KEY)
    prompt_template = PromptTemplate(
        input_variables=["features"],
        template="""
以下の購買パターンの顧客クラスタに対して、マーケティング担当者がわかりやすく社内共有しやすい名前を1つつけてください。
特徴: {features}
例:「昼間によく来るシニア女性」「頻繁にまとめ買いする家族層」など
"""
    )
    cluster_descriptions = []
    for cluster_id in sorted(agg_df["クラスタ"].unique()):
        sub = agg_df[agg_df["クラスタ"] == cluster_id][features]
        desc = sub.mean().round(2).to_dict()
        cluster_descriptions.append((cluster_id, desc))
    cluster_names = {}
    for cluster_id, desc in cluster_descriptions:
        prompt = prompt_template.format(features=desc)
        messages = [
            SystemMessage(content="あなたはマーケティング部門の分析担当者です。"),
            HumanMessage(content=prompt)
        ]
        response = llm(messages)
        cluster_names[str(cluster_id)] = response.content.strip()
    agg_df["クラスタ名"] = agg_df["クラスタ"].map(lambda x: cluster_names[str(x)])
    return agg_df, cluster_names

# --- レーダーチャート用データ生成 ---
def get_radar_chart_data(df, features, cluster_label_col="クラスタ名"):
    # クラスタごとに特徴量の平均値を計算（実数値のまま）
    cluster_summary = df.groupby(cluster_label_col)[features].mean()
    # Recharts用データ形式に変換
    data = []
    for metric in cluster_summary.columns:
        row = {"metric": metric}
        for cluster in cluster_summary.index:
            # 実数値を小数第2位まで四捨五入
            row[cluster] = round(cluster_summary.loc[cluster, metric], 2)
        data.append(row)
    return data

# --- メイン処理関数 ---
def cluster_main(df, n_clusters=4):
    try:
        import logging
        logging.info(f"クラスタリング開始: {len(df)} 行, {len(df.columns)} 列")

        df = flexible_preprocess(df)
        logging.info(f"前処理完了: {len(df)} 行, {len(df.columns)} 列")

        # 特徴量リスト
        features = list(df.columns)
        logging.info(f"特徴量: {features}")

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(df[features])
        logging.info(f"スケーリング完了: {X_scaled.shape}")

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
        df["クラスタ"] = kmeans.fit_predict(X_scaled)
        logging.info("K-means完了")

        # LLMでクラスタ名付け
        logging.info("LLMクラスタ名付け開始")
        load_dotenv(find_dotenv("../.env"))
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        llm = ChatOpenAI(model="gpt-4", temperature=0.7, openai_api_key=OPENAI_API_KEY)
        prompt_template = PromptTemplate(
            input_variables=["features"],
            template="""
以下の購買パターンの顧客クラスタに対して、マーケティング担当者がわかりやすく社内共有しやすい名前を1つつけてください。
特徴: {features}
例:「昼間によく来るシニア女性」「頻繁にまとめ買いする家族層」など
"""
        )
        cluster_descriptions = []
        for cluster_id in sorted(df["クラスタ"].unique()):
            sub = df[df["クラスタ"] == cluster_id][features]
            desc = sub.mean().round(2).to_dict()
            cluster_descriptions.append((cluster_id, desc))

        cluster_names = {}
        for cluster_id, desc in cluster_descriptions:
            prompt = prompt_template.format(features=desc)
            messages = [
                SystemMessage(content="あなたはマーケティング部門の分析担当者です。"),
                HumanMessage(content=prompt)
            ]
            response = llm(messages)
            cluster_names[str(cluster_id)] = response.content.strip()

        df["クラスタ名"] = df["クラスタ"].map(lambda x: cluster_names[str(x)])
        logging.info("LLMクラスタ名付け完了")

        # レーダーチャートデータ生成
        logging.info("レーダーチャートデータ生成開始")
        radar_chart_data = get_radar_chart_data(df, features, "クラスタ名")
        logging.info("レーダーチャートデータ生成完了")

        logging.info("クラスタリング処理完了")
        return {
            "agg_df": df,
            "cluster_names": cluster_names,
            "radar_chart_data": radar_chart_data
        }

    except Exception as e:
        import logging
        import traceback
        logging.error(f"クラスタリングエラー: {str(e)}")
        logging.error(f"エラー詳細: {type(e).__name__}")
        logging.error(f"スタックトレース: {traceback.format_exc()}")
        raise
