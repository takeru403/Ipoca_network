import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd
import matplotlib.font_manager as fm
from networkx.algorithms import community

def create_network_plot(file):
    # データ読み込み
    df = (
        pd.read_csv(file)
        if file.filename.endswith(".csv")
        else pd.read_excel(file, sheet_name="Sheet1")
    )

    # グラフ構築
    G = nx.Graph()
    for _, row in df.iterrows():
        source = row["antecedents"]
        target = row["consequents"]
        weight = row["lift"]
        G.add_edge(source, target, weight=weight)

    # 媒介中心性
    bet_cent = nx.betweenness_centrality(G, weight="weight", normalized=True)
    node_sizes = [bet_cent[n] * 5000 + 100 for n in G.nodes()]

    # コミュニティ検出
    communities = community.greedy_modularity_communities(G, weight="weight")
    node_community = {n: cid for cid, com in enumerate(communities) for n in com}

    # 色設定
    cmap = plt.cm.get_cmap("tab20")
    node_colors = [cmap(node_community[n] % 20) for n in G.nodes()]

    # レイアウト
    pos = nx.spring_layout(G, seed=42, k=0.3)

    # 描画
    fig = plt.figure(figsize=(14, 14))
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, node_color=node_colors, alpha=0.9)
    edge_widths = [d["weight"] * 1.5 for (_, _, d) in G.edges(data=True)]
    nx.draw_networkx_edges(G, pos, width=edge_widths, alpha=0.5)

    try:
        jp_font_path = "/usr/share/fonts/truetype/ipaexfont-gothic/ipaexg.ttf"
        jp_font = fm.FontProperties(fname=jp_font_path)
        nx.draw_networkx_labels(G, pos, font_size=10, font_properties=jp_font)
    except:
        nx.draw_networkx_labels(G, pos, font_size=10, font_family="IPAexGothic")

    plt.title("リフト値ネットワーク（ノードサイズ:媒介中心性, 色:コミュニティ）")
    plt.axis("off")
    plt.tight_layout()

    return fig
