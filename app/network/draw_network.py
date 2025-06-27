import networkx as nx
import pandas as pd
from networkx.algorithms import community
import logging

def create_network_json(file):
    try:
        # ファイル読み込み
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file, sheet_name="Sheet1")

        # 必要な列の存在確認
        required_columns = ["antecedents", "consequents", "lift"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"必要な列が不足しています: {missing_columns}")

        # データの前処理
        df = df.dropna(subset=required_columns)
        if df.empty:
            raise ValueError("有効なデータがありません")

        # グラフの構築
        G = nx.Graph()
        for _, row in df.iterrows():
            source = str(row["antecedents"]).strip()
            target = str(row["consequents"]).strip()
            weight = float(row["lift"])

            if source and target and source != target:
                G.add_edge(source, target, weight=weight)

        if len(G.nodes()) == 0:
            raise ValueError("有効なノードがありません")

        # 中心性指標の計算
        try:
            betweenness = nx.betweenness_centrality(G, weight="weight", normalized=True)
        except:
            betweenness = nx.betweenness_centrality(G, normalized=True)

        try:
            degree = nx.degree_centrality(G)
        except:
            degree = {node: 0 for node in G.nodes()}

        try:
            closeness = nx.closeness_centrality(G, distance="weight")
        except:
            closeness = nx.closeness_centrality(G)

        try:
            eigenvector = nx.eigenvector_centrality_numpy(G, weight="weight")
        except:
            eigenvector = {node: 0 for node in G.nodes()}

        # コミュニティ検出
        try:
            communities = community.greedy_modularity_communities(G, weight="weight")
        except:
            # フォールバック: 重みなしでコミュニティ検出
            communities = community.greedy_modularity_communities(G)

        node_community = {n: cid for cid, com in enumerate(communities) for n in com}

        # ノードデータの作成
        nodes = [
            {
                "id": n,
                "betweenness": float(betweenness.get(n, 0)),
                "degree": float(degree.get(n, 0)),
                "closeness": float(closeness.get(n, 0)),
                "eigenvector": float(eigenvector.get(n, 0)),
                "group": int(node_community.get(n, 0))
            }
            for n in G.nodes()
        ]

        # リンクデータの作成
        links = [
            {
                "source": u,
                "target": v,
                "value": float(d.get("weight", 1))
            }
            for u, v, d in G.edges(data=True)
        ]

        logging.info(f"Network created successfully: {len(nodes)} nodes, {len(links)} links, {len(communities)} communities")
        return {"nodes": nodes, "links": links}

    except Exception as e:
        logging.error(f"Error in create_network_json: {str(e)}")
        raise
