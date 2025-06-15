import networkx as nx
import pandas as pd
from networkx.algorithms import community, centrality

def create_network_json(file):
    df = (
        pd.read_csv(file)
        if file.filename.endswith(".csv")
        else pd.read_excel(file, sheet_name="Sheet1")
    )

    G = nx.Graph()
    for _, row in df.iterrows():
        source = row["antecedents"]
        target = row["consequents"]
        weight = row["lift"]
        G.add_edge(source, target, weight=weight)

    # 各種中心性指標の計算
    betweenness = nx.betweenness_centrality(G, weight="weight", normalized=True)
    degree = nx.degree_centrality(G)
    closeness = nx.closeness_centrality(G, distance="weight")
    eigenvector = nx.eigenvector_centrality_numpy(G, weight="weight")

    # コミュニティ検出
    communities = community.greedy_modularity_communities(G, weight="weight")
    node_community = {n: cid for cid, com in enumerate(communities) for n in com}

    nodes = [
        {
            "id": n,
            "betweenness": betweenness[n],
            "degree": degree[n],
            "closeness": closeness[n],
            "eigenvector": eigenvector[n],
            "group": node_community.get(n, 0)
        }
        for n in G.nodes()
    ]

    links = [
        {
            "source": u,
            "target": v,
            "value": d.get("weight", 1)
        }
        for u, v, d in G.edges(data=True)
    ]

    # ネットワークの基本統計量を計算
    stats = {
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
        "density": nx.density(G),
        "average_clustering": nx.average_clustering(G, weight="weight"),
        "average_shortest_path_length": nx.average_shortest_path_length(G, weight="weight"),
        "community_count": len(communities)
    }

    return {
        "nodes": nodes,
        "links": links,
        "stats": stats
    }
