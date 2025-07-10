import pandas as pd
import numpy as np
import os
import networkx as nx
from mlxtend.frequent_patterns import apriori, association_rules
import logging
from concurrent.futures import ThreadPoolExecutor
import multiprocessing
from dotenv import find_dotenv, load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import SecretStr
import re
import ast
load_dotenv(find_dotenv("../.env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(model="gpt-4", temperature=0.7, api_key=SecretStr(OPENAI_API_KEY) if OPENAI_API_KEY else None)

# 必要な列名リスト
REQUIRED_COLUMNS = [
    'カード番号',        # 顧客ID
    '利用日時',        # 購入日時
    '利用金額',        # 購入金額
    'ショップ名略称',  # 店舗名
    'テナント名',     # テナント名（ショップ名略称と同義の場合もあるが両方サポート）
    'カテゴリ'         # 商品カテゴリや分類（任意）
]

# LLMによる列名マッピング関数

def llm_column_mapping(column_names):
    """
    LLMを使ってアップロードファイルの列名を必要な列名（カード番号、利用日時、利用金額、ショップ名略称、テナント名、カテゴリ）に自動マッピングする
    入力: column_names = ['customer_id', 'date', ...]
    出力: {'customer_id': 'カード番号', ...}
    """
    prompt = f"""
    以下はPOSデータの列名リストです：\n{column_names}\n
    それぞれの列がどの日本語の標準列名（{REQUIRED_COLUMNS}）に対応するか、辞書形式で出力してください。\n
    例：{{'customer_id': 'カード番号', 'date': '利用日時', ...}}
    ※「テナント名」は「ショップ名略称」と同じ列でも構いません。明確に区別できない場合は同じ列を割り当ててください。
    ※「カテゴリ」は商品カテゴリや分類に該当する列を割り当ててください。該当しない場合は割り当てなくても構いません。
    """
    response = llm.invoke(prompt)
    try:
        content_str = response.content
        if not isinstance(content_str, str):
            content_str = str(content_str)
        # 辞書部分だけ抽出
        match = re.search(r'\{.*\}', content_str, re.DOTALL)
        if match:
            dict_str = match.group(0)
            mapping = ast.literal_eval(dict_str)
            return mapping
        else:
            logging.error(f"列名マッピングの辞書部分が見つかりません: {content_str}")
            return {}
    except Exception as e:
        logging.error(f"列名マッピングのパースエラー: {e}\n返答: {response.content}")
        return {}

def calc_asociation(df, min_support=0.0001, max_len=2):
    """
    POSデータからアソシエーション分析を実行
    高速化のため、データ処理を最適化
    """
    try:
        logging.info("アソシエーション分析開始")
        logging.info(f"入力データ: {len(df)} 行, {len(df.columns)} 列")

        # 1) 購買重複データの削除（高速化）
        logging.info("重複データ削除開始")
        df_sorted = df.sort_values(
            by=['カード番号', '利用日時', '利用金額'],
            ascending=[True, True, False]
        )
        df_unique = df_sorted.drop_duplicates(
            subset=['カード番号', '利用日時'],
            keep='first'
        )
        logging.info(f"重複削除後: {len(df_unique)} レコード")

        # 2) 店舗ごとの利用金額合計を計算
        logging.info("店舗ごとの利用金額合計計算開始")
        shop_revenue = df_unique.groupby('ショップ名略称')['利用金額'].sum().reset_index()
        shop_revenue_dict = dict(zip(shop_revenue['ショップ名略称'], shop_revenue['利用金額']))

        # 3) Pivotテーブル作成（メモリ効率化）
        logging.info("ピボットテーブル作成開始")
        # 事前にデータ型を最適化
        df_unique['カード番号'] = df_unique['カード番号'].astype('category')
        df_unique['ショップ名略称'] = df_unique['ショップ名略称'].astype('category')

        # グループ化とピボット作成
        temp = df_unique.groupby(['カード番号', 'ショップ名略称']).size().reset_index(name='購入数')
        pivot = temp.pivot(index='カード番号', columns='ショップ名略称', values='購入数').fillna(0)

        # 購入の有無を True/False に変換
        basket = (pivot > 0).astype(bool)

        # 空の列を削除
        basket = basket.loc[:, basket.sum() > 0]

        logging.info(f"ピボットテーブル作成完了: {basket.shape}")

        # 4) アソシエーション分析（並列処理対応）
        logging.info("アソシエーション分析実行開始")
        freq_item = apriori(
            basket,
            min_support=min_support,
            use_colnames=True,
            max_len=max_len,
            low_memory=True
        )

        if len(freq_item) == 0:
            logging.warning("頻出アイテムセットが見つかりませんでした")
            return pd.DataFrame(columns=['antecedents', 'consequents', 'lift', 'support', 'confidence', 'antecedent_revenue', 'consequent_revenue', 'total_revenue'])

        logging.info(f"頻出アイテムセット: {len(freq_item)} 件")

        rules = association_rules(
            freq_item,
            metric='lift',
            min_threshold=1,
            num_itemsets=min(freq_item.shape[0], 1000)  # 最大1000件に制限
        ).reset_index(drop=True)

        # 5) antecedents/consequents を文字列に変換
        logging.info("ルール形式変換開始")
        for i in range(len(rules)):
            if isinstance(rules.at[i, 'antecedents'], (list, set, frozenset)):
                rules.at[i, 'antecedents'] = list(rules.at[i, 'antecedents'])[0]
            if isinstance(rules.at[i, 'consequents'], (list, set, frozenset)):
                rules.at[i, 'consequents'] = list(rules.at[i, 'consequents'])[0]
        # 文字列型に変換
        rules['antecedents'] = rules['antecedents'].astype(str)
        rules['consequents'] = rules['consequents'].astype(str)

        # 6) 店舗ごとの利用金額を追加
        logging.info("店舗利用金額情報追加開始")
        rules['antecedent_revenue'] = rules['antecedents'].map(shop_revenue_dict).fillna(0)
        rules['consequent_revenue'] = rules['consequents'].map(shop_revenue_dict).fillna(0)
        rules['total_revenue'] = rules['antecedent_revenue'] + rules['consequent_revenue']

        # lift列がなければ追加
        if 'lift' not in rules.columns:
            rules['lift'] = np.nan

        logging.info(f"アソシエーション分析完了: {len(rules)} ルール")
        return rules

    except Exception as e:
        logging.error(f"アソシエーション分析エラー: {str(e)}")
        import traceback
        logging.error(f"スタックトレース: {traceback.format_exc()}")
        # 空DataFrameで返す（必ず必要な列を持つ）
        return pd.DataFrame(columns=['antecedents', 'consequents', 'lift', 'support', 'confidence', 'antecedent_revenue', 'consequent_revenue', 'total_revenue'])

def build_node_edge_df(rules, mall_name, full_tenant_list=None):
    """
    ノード・エッジデータフレームの作成
    """
    try:
        if len(rules) == 0:
            return pd.DataFrame(columns=pd.Index(['Id', 'is_added', 'revenue'])), pd.DataFrame(columns=pd.Index(['Source', 'Target', 'Weight', 'total_revenue']))

        # edge_df: lift → Weight, total_revenue追加
        edge_df = (
            rules[['antecedents', 'consequents', 'lift', 'total_revenue']]
            .rename(columns={
                'antecedents': 'Source',
                'consequents':  'Target',
                'lift':         'Weight',
                'total_revenue': 'total_revenue'
            })
        )

        # ルールに出てくるノード
        node_ids = pd.unique(edge_df[['Source','Target']].values.ravel('K'))

        # 店舗ごとの利用金額合計を計算
        shop_revenue = {}
        for _, rule in rules.iterrows():
            antecedent = rule['antecedents']
            consequent = rule['consequents']
            antecedent_revenue = rule.get('antecedent_revenue', 0)
            consequent_revenue = rule.get('consequent_revenue', 0)

            if antecedent not in shop_revenue:
                shop_revenue[antecedent] = antecedent_revenue
            if consequent not in shop_revenue:
                shop_revenue[consequent] = consequent_revenue

        if full_tenant_list is not None:
            # numpy配列に変換して結合
            node_ids_array = np.array(node_ids)
            full_tenant_array = np.array(full_tenant_list)
            all_ids = np.unique(np.concatenate([node_ids_array, full_tenant_array]))
        else:
            all_ids = node_ids

        # ノードデータフレームに利用金額を追加
        node_df = pd.DataFrame({
            'Id':       node_ids,
            'is_added': False,
            'revenue':  [shop_revenue.get(shop_id, 0) for shop_id in node_ids]
        })

        added = np.setdiff1d(np.array(list(all_ids)), np.array(list(node_ids)))
        if len(added) > 0:
            added_df = pd.DataFrame({
                'Id': added,
                'is_added': True,
                'revenue': [shop_revenue.get(shop_id, 0) for shop_id in added]
            })
            node_df = pd.concat([node_df, added_df], ignore_index=True)

        return node_df, edge_df

    except Exception as e:
        logging.error(f"ノード・エッジ作成エラー: {str(e)}")
        raise

def process_pos_data_background(df, min_support=0.0001, max_len=2):
    """
    バックグラウンドでPOSデータを処理
    """
    try:
        logging.info("バックグラウンド処理開始")

        # アソシエーション分析
        rules = calc_asociation(df, min_support=min_support, max_len=max_len)

        # ノード・エッジデータ作成
        node_df, edge_df = build_node_edge_df(rules, "mall_name")

        return {
            'rules': rules,
            'nodes': node_df,
            'edges': edge_df,
            'status': 'completed'
        }

    except Exception as e:
        logging.error(f"バックグラウンド処理エラー: {str(e)}")
        return {
            'error': str(e),
            'status': 'failed'
        }
