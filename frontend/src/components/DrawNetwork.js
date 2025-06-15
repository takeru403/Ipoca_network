import React, { useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";

const DrawNetwork = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("betweenness");
  const [linkThreshold, setLinkThreshold] = useState(1);
  const [nodeSize, setNodeSize] = useState(1);
  const [showLabels, setShowLabels] = useState(true);

  // より自然な色パレットを定義
  const communityColors = [
    "#8dd3c7",  // ソフトミント
    "#bebada",  // ラベンダー
    "#fb8072",  // サーモンピンク
    "#80b1d3",  // スカイブルー
    "#fdb462",  // ピーチ
    "#b3de69",  // ライムグリーン
    "#fccde5",  // ライトピンク
    "#d9d9d9",  // ライトグレー
  ];

  const networkMetrics = {
    betweenness: "媒介中心性",
    degree: "次数中心性",
    closeness: "近接中心性",
    eigenvector: "固有ベクトル中心性",
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const response = await fetch("/api/network", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setGraphData({
        nodes: data.nodes || [],
        links: data.links || []
      });
    } catch (err) {
      console.error("ファイルのアップロードに失敗しました", err);
    }
    setLoading(false);
  };

  const handleMetricChange = useCallback((metric) => {
    setSelectedMetric(metric);
  }, []);

  const getNodeValue = useCallback((node) => {
    return (node[selectedMetric] || 0) * nodeSize;
  }, [selectedMetric, nodeSize]);

  const getLinkValue = useCallback((link) => {
    return (link.value || 0) >= linkThreshold ? Math.sqrt(link.value) : 0;
  }, [linkThreshold]);

  const styles = {
    controlPanel: {
      padding: "20px",
      marginBottom: "20px",
      backgroundColor: "#f5f5f5",
      borderRadius: "8px",
    },
    controlGroup: {
      marginBottom: "15px",
    },
    button: {
      margin: "0 5px",
      padding: "8px 15px",
      backgroundColor: "#4a90e2",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    },
    activeButton: {
      backgroundColor: "#2c5282",
    },
    slider: {
      width: "200px",
      marginLeft: "10px",
    },
  };

  return (
    <section className="network-container">
      <h2 className="section-title">1. ネットワーク描画</h2>
      <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} />
      {loading && <p>読み込み中...</p>}
      {graphData.nodes.length > 0 && (
        <>
          <div style={styles.controlPanel}>
            <div style={styles.controlGroup}>
              <h3>中心性指標の選択</h3>
              {Object.entries(networkMetrics).map(([key, label]) => (
                <button
                  key={key}
                  style={{
                    ...styles.button,
                    ...(selectedMetric === key ? styles.activeButton : {}),
                  }}
                  onClick={() => handleMetricChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={styles.controlGroup}>
              <h3>表示設定</h3>
              <div>
                <label>
                  ノードサイズ:
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={nodeSize}
                    onChange={(e) => setNodeSize(parseFloat(e.target.value))}
                    style={styles.slider}
                  />
                  {nodeSize.toFixed(1)}
                </label>
              </div>
              <div>
                <label>
                  エッジの閾値:
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={linkThreshold}
                    onChange={(e) => setLinkThreshold(parseFloat(e.target.value))}
                    style={styles.slider}
                  />
                  {linkThreshold.toFixed(1)}
                </label>
              </div>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                  />
                  ラベルを表示
                </label>
              </div>
            </div>
          </div>

          <div style={{ height: "800px", border: "1px solid #ccc", marginTop: "20px" }}>
            <ForceGraph2D
              graphData={graphData}
              nodeAutoColorBy="group"
              nodeLabel={(node) => `${node.id} (${networkMetrics[selectedMetric]}: ${(node[selectedMetric] || 0).toFixed(3)})`}
              nodeRelSize={1}
              nodeVal={getNodeValue}
              linkWidth={getLinkValue}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={(d) => (d.value || 0) * 0.01}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.id;
                const fontSize = 12 / globalScale;
                const nodeColor = communityColors[(node.group || 0) % communityColors.length];
                const size = getNodeValue(node);

                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = nodeColor;
                ctx.fill();
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (showLabels) {
                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.fillStyle = "#000";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText(label, node.x, node.y);
                }
              }}
            />
          </div>

          <div style={{ marginTop: "20px" }}>
            <h3>凡例</h3>
            <p>• ノードの大きさ: 選択した中心性指標を表します（大きいほど中心性が高い）</p>
            <p>• ノードの色: 同じコミュニティに属するノードは同じ色で表示されます</p>
            <p>• エッジの太さ: 関連の強さを表します（閾値以下の関連は非表示）</p>
          </div>
        </>
      )}
    </section>
  );
};

export default DrawNetwork;
