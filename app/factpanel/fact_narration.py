import os
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv("../.env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate

import pandas as pd
import openai
import numpy as np

def select_important_columns(df: pd.DataFrame, num_cols: int = 3):
    # 数値列: 分散が大きい順に上位num_cols列
    num_df = df.select_dtypes(include='number')
    if len(num_df.columns) > 0:
        num_var = num_df.var().sort_values(ascending=False)
        num_columns = list(num_var.head(num_cols).index)
    else:
        num_columns = []
    # カテゴリ列: ユニーク数が多い順に上位num_cols列
    cat_df = df.select_dtypes(include='object')
    if len(cat_df.columns) > 0:
        cat_unique = cat_df.nunique().sort_values(ascending=False)
        cat_columns = list(cat_unique.head(num_cols).index)
    else:
        cat_columns = []
    return num_columns, cat_columns

def generate_facts_summary(df: pd.DataFrame, num_cols: int = 3):
    facts = []
    num_columns, cat_columns = select_important_columns(df, num_cols)
    # 数値列
    for col in num_columns:
        facts.append(f"{col}: 平均={df[col].mean():.2f}, 標準偏差={df[col].std():.2f}, 最大={df[col].max()}, 最小={df[col].min()}")
    # カテゴリ列
    for col in cat_columns:
        try:
            mode = df[col].mode().iloc[0]
        except Exception:
            mode = "-"
        top2 = df[col].value_counts().head(2).to_dict()
        facts.append(f"{col}: ユニーク={df[col].nunique()}種, 最頻値={mode}, 上位2={top2}")
    return '\n'.join(facts)

def generate_narration_with_llm(df: pd.DataFrame, age_column=None, min_age=None, max_age=None) -> str:
    num_columns, cat_columns = select_important_columns(df, 2)
    # 年齢情報の記述を追加
    age_info = ""
    if age_column and age_column in df.columns:
        age_series = pd.to_numeric(df[age_column], errors='coerce').dropna()
        if not age_series.empty:
            min_age_val = int(age_series.min()) if min_age is None else int(min_age)
            max_age_val = int(age_series.max()) if max_age is None else int(max_age)
            # ボリューム年齢層（最頻値）
            mode_age = int(age_series.mode().iloc[0]) if not age_series.mode().empty else None
            # 10歳刻みのボリューム層
            bins = list(range(0, 101, 10))
            age_hist = pd.cut(age_series, bins, right=False)
            volume_bin = age_hist.value_counts().idxmax() if not age_hist.empty else None
            if volume_bin is not None:
                volume_str = f"{int(volume_bin.left)}代"
            else:
                volume_str = f"{mode_age}歳"
            age_info = f"このデータの年齢範囲は{min_age_val}歳から{max_age_val}歳で、最も多い年齢層は{volume_str}です。"
    # 数値列describe（count, mean, std, min, maxのみ）
    describe_num = ""
    if num_columns:
        desc = df[num_columns].describe().loc[["count", "mean", "std", "min", "max"]]
        describe_num = desc.to_string()
    # カテゴリ列describe（count, unique, top, freqのみ）
    describe_cat = ""
    if cat_columns:
        desc = df[cat_columns].describe().loc[["count", "unique", "top", "freq"]]
        describe_cat = desc.to_string()
    # サンプルは1行だけ
    sample_str = df.sample(n=1, random_state=42).to_string(index=False)
    # 代表的な統計情報
    facts_summary = generate_facts_summary(df, 2)
    prompt = f"""
あなたはPOSデータのナレーターです。以下の統計情報とサンプルデータをもとに、POSデータから読み取れる客観的な事実のみを、淡々としたナレーション形式で一つのストーリーとして自然な日本語で述べてください。

分析や推測、主観的な表現は避け、事実のみを時系列や全体の流れを意識して、聞き手が状況をイメージしやすいようにまとめてください。

# 年齢情報
{age_info}

# 代表的な統計情報
{facts_summary}

# 数値列のdescribe（count, mean, std, min, max）
{describe_num}

# カテゴリ列のdescribe（count, unique, top, freq）
{describe_cat}

# サンプルデータ（1行のみ）
{sample_str}
"""
    llm = ChatOpenAI(
        openai_api_key=OPENAI_API_KEY,
        model_name="gpt-4-turbo",
        temperature=0.2
    )
    narration = llm.predict(prompt)
    return narration

def generate_narration_text(df: pd.DataFrame) -> str:
    narration = []
    narration.append(f"データには{len(df)}件のレコードが含まれています。")
    for col in df.select_dtypes(include='number').columns:
        narration.append(
            f"{col}の平均値は{df[col].mean():.2f}、最大値は{df[col].max():.2f}、最小値は{df[col].min():.2f}です。"
        )
    return " ".join(narration)

def create_narration_audio(text: str, filename="fact_narration.mp3"):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    with open(filename, "wb") as f:
        f.write(response.content)
    return filename

def generate_data_facts(df: pd.DataFrame) -> str:
    facts = []
    # レコード数
    facts.append(f"データには{len(df)}件のレコードがあります。")
    # メモリ使用量
    facts.append(f"データ全体のメモリ使用量は{df.memory_usage(deep=True).sum()//1024}KBです。")
    # 重複行
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        facts.append(f"重複した行が{dup_count}件存在します。")
    else:
        facts.append("重複した行はありません。")
    # 欠損値
    na_counts = df.isna().sum()
    na_cols = na_counts[na_counts > 0]
    if not na_cols.empty:
        for col, cnt in na_cols.items():
            facts.append(f"{col}には{cnt}件の欠損値があります。")
    else:
        facts.append("欠損値はありません。")
    # 数値列の統計量
    for col in df.select_dtypes(include='number').columns:
        facts.append(f"【{col}】")
        facts.append(f"平均値: {df[col].mean():.2f}、中央値: {df[col].median():.2f}、標準偏差: {df[col].std():.2f}、最大値: {df[col].max():.2f}、最小値: {df[col].min():.2f}")
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        facts.append(f"第1四分位数: {q1:.2f}、第3四分位数: {q3:.2f}、四分位範囲: {iqr:.2f}")
        # 歪度・尖度
        facts.append(f"歪度: {df[col].skew():.2f}、尖度: {df[col].kurt():.2f}")
        # 最頻値
        try:
            facts.append(f"最頻値: {df[col].mode().iloc[0]}")
        except Exception:
            pass
        # ユニーク値
        facts.append(f"ユニーク値の数: {df[col].nunique()}件")
        # ゼロ値・負値
        zero_count = (df[col] == 0).sum()
        neg_count = (df[col] < 0).sum()
        facts.append(f"ゼロ値: {zero_count}件、負値: {neg_count}件")
        # 変動係数
        if df[col].mean() != 0:
            facts.append(f"変動係数: {df[col].std()/df[col].mean():.2f}")
        # 外れ値
        outliers = df[(df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)]
        if not outliers.empty:
            facts.append(f"外れ値: {len(outliers)}件")
        # 上位・下位5件
        facts.append(f"上位5件: {df[col].sort_values(ascending=False).head(5).values}")
        facts.append(f"下位5件: {df[col].sort_values().head(5).values}")
    # カテゴリ列の情報
    for col in df.select_dtypes(include='object').columns:
        facts.append(f"【{col}】")
        facts.append(f"ユニークな値: {df[col].nunique()}種類")
        try:
            facts.append(f"最頻値: {df[col].mode().iloc[0]}")
        except Exception:
            pass
        value_counts = df[col].value_counts()
        facts.append(f"全カテゴリと件数: {', '.join([f'{idx}({cnt}件)' for idx, cnt in value_counts.items()])}")
        facts.append(f"上位3カテゴリと割合: {', '.join([f'{idx}({cnt/len(df)*100:.1f}%)' for idx, cnt in value_counts.head(3).items()])}")
    # クロス集計（カテゴリ列が2つ以上ある場合）
    cat_cols = df.select_dtypes(include='object').columns
    if len(cat_cols) >= 2:
        cross = df.groupby(list(cat_cols[:2])).size().reset_index(name='count')
        facts.append(f"{cat_cols[0]}×{cat_cols[1]}の組み合わせ件数（上位5件）: {cross.sort_values('count', ascending=False).head(5).to_dict(orient='records')}")
    # 相関係数（数値列が10列以下の場合のみ）
    num_cols = df.select_dtypes(include='number').columns
    if len(num_cols) > 1 and len(num_cols) <= 10:
        corr = df[num_cols].corr()
        corr_pairs = []
        for i, col1 in enumerate(num_cols):
            for j, col2 in enumerate(num_cols):
                if i < j:
                    val = corr.loc[col1, col2]
                    if abs(val) > 0.5:
                        corr_pairs.append(f"{col1}と{col2}の相関係数は{val:.2f}")
        if corr_pairs:
            facts.append("強い相関が見られる組み合わせ:")
            facts.extend(corr_pairs)
    # データの期間（date/datetime型があれば）
    for col in df.columns:
        if np.issubdtype(np.dtype(df[col].dtype), np.datetime64):
            facts.append(f"{col}の期間は{df[col].min().date()}から{df[col].max().date()}です。")
    # サンプル表示
    facts.append(f"データのサンプル（ランダム3件）:\n{df.sample(min(3, len(df))).to_string(index=False)}")
    return '\n'.join(facts)
