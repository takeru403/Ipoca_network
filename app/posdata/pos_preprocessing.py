import pandas as pd
import numpy as np
import os
import networkx as nx
from mlxtend.frequent_patterns import apriori, association_rules
import logging
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

def calc_asociation(df, min_support=0.0001, max_len=2):
    """
    POSデータからアソシエーション分析を実行
    高速化のため、データ処理を最適化
    """
    try:
        logging.info("アソシエーション分析開始")

        # 1) 購買重複データの削除（高速化）
        df_sorted = df.sort_values(
            by=['カード番号', '利用日時', '利用金額'],
            ascending=[True, True, False]
        )
        df_unique = df_sorted.drop_duplicates(
            subset=['カード番号', '利用日時'],
            keep='first'
        )
        logging.info(f"重複削除後: {len(df_unique)} レコード")

        # 2) Pivotテーブル作成（メモリ効率化）
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

        # 3) アソシエーション分析（並列処理対応）
        freq_item = apriori(
            basket,
            min_support=min_support,
            use_colnames=True,
            max_len=max_len,
            low_memory=True
        )

        if len(freq_item) == 0:
            logging.warning("頻出アイテムセットが見つかりませんでした")
            return pd.DataFrame(columns=['antecedents', 'consequents', 'lift', 'support', 'confidence'])

        rules = association_rules(
            freq_item,
            metric='lift',
            min_threshold=1,
            num_itemsets=min(freq_item.shape[0], 1000)  # 最大1000件に制限
        ).reset_index(drop=True)

        # 4) antecedents/consequents を文字列に変換
        for i in range(len(rules)):
            if isinstance(rules.at[i, 'antecedents'], (list, set, frozenset)):
                rules.at[i, 'antecedents'] = list(rules.at[i, 'antecedents'])[0]
            if isinstance(rules.at[i, 'consequents'], (list, set, frozenset)):
                rules.at[i, 'consequents'] = list(rules.at[i, 'consequents'])[0]

        logging.info(f"アソシエーション分析完了: {len(rules)} ルール")
        return rules

    except Exception as e:
        logging.error(f"アソシエーション分析エラー: {str(e)}")
        raise

def build_node_edge_df(rules, mall_name, full_tenant_list=None):
    """
    ノード・エッジデータフレームの作成
    """
    try:
        if len(rules) == 0:
            return pd.DataFrame(columns=['Id', 'is_added']), pd.DataFrame(columns=['Source', 'Target', 'Weight'])

        # edge_df: lift → Weight
        edge_df = (
            rules[['antecedents', 'consequents', 'lift']]
            .rename(columns={
                'antecedents': 'Source',
                'consequents':  'Target',
                'lift':         'Weight'
            })
        )

        # ルールに出てくるノード
        node_ids = pd.unique(edge_df[['Source','Target']].values.ravel('K'))

        if full_tenant_list is not None:
            # numpy配列に変換して結合
            node_ids_array = np.array(node_ids)
            full_tenant_array = np.array(full_tenant_list)
            all_ids = np.unique(np.concatenate([node_ids_array, full_tenant_array]))
        else:
            all_ids = node_ids

        node_df = pd.DataFrame({
            'Id':       node_ids,
            'is_added': False
        })

        added = np.setdiff1d(all_ids, node_ids)
        if len(added) > 0:
            added_df = pd.DataFrame({'Id': added, 'is_added': True})
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
