import React, { useState, useCallback, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";

const DrawNetwork = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [centralityType, setCentralityType] = useState("betweenness");
  const [nodeSize, setNodeSize] = useState(4);
  const [linkWidth, setLinkWidth] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [labelSize, setLabelSize] = useState(8);

  // コミュニティカラーの定義
  const communityColors = useMemo(() => [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#ff9896", "#98df8a", "#c5b0d5", "#c49c94", "#f7b6d2"
  ], []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/network', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `エラーが発生しました: ${response.status}`);
      }
      const data = await response.json();
      setGraphData(data);
    } catch (error) {
      setError(error.message || 'ネットワークの作成中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // コミュニティ色＋中心性で透明度
  const getNodeColor = useCallback((node) => {
    const color = communityColors[node.group % communityColors.length];
    const value = node[centralityType] || 0;
    const alpha = 0.5 + value * 0.5;
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }, [centralityType, communityColors]);

  // ノードサイズ
  const getNodeSize = useCallback((node) => {
    const value = node[centralityType] || 0;
    return nodeSize * (1 + value * 3);
  }, [centralityType, nodeSize]);

  // ラベルサイズ
  const getLabelSize = useCallback((node) => {
    if (!showLabels) return 0;
    const value = node[centralityType] || 0;
    return labelSize * (1 + value);
  }, [showLabels, labelSize, centralityType]);

  return (
    <section className="section network-container">
      <h2 className="section-title">3. ネットワーク描画</h2>
      <div className="upload-area">
        <h3 style={{ margin: "0 0 1rem 0", color: "#007bff", fontWeight: "600" }}>🌐 ネットワークファイル</h3>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileUpload}
          className="file-input"
          style={{ marginRight: "10px" }}
        />
        {loading && <span className="status-message">⏳ 読み込み中...</span>}
        {error && (
          <div className="error-message">
            <strong>エラー:</strong> {error}
          </div>
        )}
      </div>
      {graphData.nodes.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "rgba(248, 249, 250, 0.8)", borderRadius: "16px", border: "1px solid rgba(0, 123, 255, 0.1)" }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#007bff", fontWeight: "600" }}>⚙️ 表示設定</h3>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px", fontWeight: "500" }}>
              🎯 中心性指標:
              <select
                value={centralityType}
                onChange={(e) => setCentralityType(e.target.value)}
                style={{ marginLeft: "5px", padding: "0.3rem", border: "2px solid #e9ecef", borderRadius: "8px" }}
              >
                <option value="betweenness">媒介中心性</option>
                <option value="degree">次数中心性</option>
                <option value="closeness">近接中心性</option>
                <option value="eigenvector">固有ベクトル中心性</option>
              </select>
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px", fontWeight: "500" }}>
              📏 ノードサイズ:
              <input
                type="range"
                min="2"
                max="8"
                value={nodeSize}
                onChange={(e) => setNodeSize(Number(e.target.value))}
                style={{ marginLeft: "5px" }}
              />
              {nodeSize}
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px", fontWeight: "500" }}>
              📝 ラベルサイズ:
              <input
                type="range"
                min="6"
                max="16"
                value={labelSize}
                onChange={(e) => setLabelSize(Number(e.target.value))}
                style={{ marginLeft: "5px" }}
              />
              {labelSize}
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px", fontWeight: "500" }}>
              🔗 リンクの太さ:
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={linkWidth}
                onChange={(e) => setLinkWidth(Number(e.target.value))}
                style={{ marginLeft: "5px" }}
              />
              {linkWidth}
            </label>
          </div>
          <div>
            <label style={{ fontWeight: "500" }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                style={{ marginRight: "5px" }}
              />
              🏷️ ラベルを表示
            </label>
          </div>
        </div>
      )}
      {graphData.nodes.length > 0 ? (
        <div style={{ height: "800px", border: "2px solid rgba(0, 123, 255, 0.1)", borderRadius: "16px", marginTop: "20px", background: "rgba(255, 255, 255, 0.8)", overflow: "hidden" }}>
          <ForceGraph2D
            graphData={graphData}
            nodeColor={getNodeColor}
            nodeRelSize={getNodeSize}
            linkWidth={(link) => linkWidth * Math.sqrt(link.value || 1)}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={(d) => (d.value || 1) * 0.01}
            nodeCanvasObject={showLabels ? (node, ctx) => {
              const label = node.id;
              const fontSize = getLabelSize(node);
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.fillStyle = "black";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, node.x, node.y);
            } : undefined}
          />
        </div>
      ) : (
        <div style={{ padding: "2rem", background: "rgba(248, 249, 250, 0.8)", borderRadius: "16px", marginTop: "20px", border: "1px solid rgba(0, 123, 255, 0.1)", textAlign: "center" }}>
          <h3 style={{ color: "#007bff", marginBottom: "1rem" }}>📁 ファイルをアップロードしてください</h3>
          <p>CSVまたはExcelファイルをアップロードしてください。</p>
          <div style={{ marginTop: "1rem", textAlign: "left", display: "inline-block" }}>
            <p><strong>ファイル形式:</strong></p>
            <ul style={{ listStyle: "none", padding: 0 }}>
              <li>📊 <strong>列名:</strong> antecedents, consequents, lift</li>
              <li>🎯 <strong>antecedents:</strong> 起点となる項目</li>
              <li>🎯 <strong>consequents:</strong> 終点となる項目</li>
              <li>📈 <strong>lift:</strong> 関連の強さ（数値）</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};

export default DrawNetwork;
