import React, { useState, useCallback, useMemo, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { saveAs } from "file-saver";

const DrawNetwork = React.memo(({ autoProcessId }) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nodeSize, setNodeSize] = useState(8);
  const [linkWidth, setLinkWidth] = useState(0.5);
  const [showLabels, setShowLabels] = useState(true);
  const [labelSize, setLabelSize] = useState(6);
  const [nodeSizeType, setNodeSizeType] = useState("betweenness"); // "betweenness", "degree", "closeness", "eigenvector", "revenue"
  const [alpha, setAlpha] = useState(0.5); // ネットワーク効果α
  const [hoverNode, setHoverNode] = useState(null); // ホバー中ノード
  const [selectedNode, setSelectedNode] = useState(null); // 選択ノード
  const fgRef = useRef(); // ForceGraph2D参照

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

  // ネットワークデータのダウンロード
  const handleDownloadNetworkData = () => {
    if (!graphData.nodes.length) return;

    // ノードデータをCSV形式でダウンロード
    const nodeColumns = ['id', 'betweenness', 'degree', 'closeness', 'eigenvector', 'group'];
    const nodeCsv = [nodeColumns.join(',')].concat(
      graphData.nodes.map(node =>
        nodeColumns.map(col => `"${node[col] || ''}"`).join(',')
      )
    ).join('\n');

    const nodeBlob = new Blob([nodeCsv], { type: "text/csv;charset=utf-8;" });
    saveAs(nodeBlob, "network_nodes.csv");

    // リンクデータをCSV形式でダウンロード
    const linkColumns = ['source', 'target', 'value'];
    const linkCsv = [linkColumns.join(',')].concat(
      graphData.links.map(link =>
        linkColumns.map(col => `"${link[col] || ''}"`).join(',')
      )
    ).join('\n');

    const linkBlob = new Blob([linkCsv], { type: "text/csv;charset=utf-8;" });
    saveAs(linkBlob, "network_links.csv");
  };

  // ネットワーク統計情報のダウンロード
  const handleDownloadNetworkStats = () => {
    if (!graphData.nodes.length) return;

    // 売上統計の計算
    const totalRevenue = graphData.nodes.reduce((sum, n) => sum + (n.revenue || 0), 0);
    const avgRevenue = totalRevenue / graphData.nodes.length;
    const maxRevenue = Math.max(...graphData.nodes.map(n => n.revenue || 0));
    const minRevenue = Math.min(...graphData.nodes.map(n => n.revenue || 0));

    // ネットワーク効果による売上への影響を推定
    const highCentralityNodes = graphData.nodes.filter(n => n.betweenness > 0.1);
    const highCentralityRevenue = highCentralityNodes.reduce((sum, n) => sum + (n.revenue || 0), 0);
    const networkEffectRatio = highCentralityRevenue / totalRevenue;

    const stats = {
      nodes_count: graphData.nodes.length,
      links_count: graphData.links.length,
      communities_count: new Set(graphData.nodes.map(n => n.group)).size,
      average_degree: graphData.links.length * 2 / graphData.nodes.length,
      density: graphData.links.length / (graphData.nodes.length * (graphData.nodes.length - 1) / 2),
      revenue_stats: {
        total_revenue: totalRevenue,
        average_revenue: avgRevenue,
        max_revenue: maxRevenue,
        min_revenue: minRevenue,
        high_centrality_revenue: highCentralityRevenue,
        network_effect_ratio: networkEffectRatio
      },
      centrality_stats: {
        betweenness: {
          min: Math.min(...graphData.nodes.map(n => n.betweenness)),
          max: Math.max(...graphData.nodes.map(n => n.betweenness)),
          avg: graphData.nodes.reduce((sum, n) => sum + n.betweenness, 0) / graphData.nodes.length
        },
        degree: {
          min: Math.min(...graphData.nodes.map(n => n.degree)),
          max: Math.max(...graphData.nodes.map(n => n.degree)),
          avg: graphData.nodes.reduce((sum, n) => sum + n.degree, 0) / graphData.nodes.length
        },
        closeness: {
          min: Math.min(...graphData.nodes.map(n => n.closeness)),
          max: Math.max(...graphData.nodes.map(n => n.closeness)),
          avg: graphData.nodes.reduce((sum, n) => sum + n.closeness, 0) / graphData.nodes.length
        },
        eigenvector: {
          min: Math.min(...graphData.nodes.map(n => n.eigenvector)),
          max: Math.max(...graphData.nodes.map(n => n.eigenvector)),
          avg: graphData.nodes.reduce((sum, n) => sum + n.eigenvector, 0) / graphData.nodes.length
        }
      }
    };

    const statsJson = JSON.stringify(stats, null, 2);
    const statsBlob = new Blob([statsJson], { type: "application/json;charset=utf-8;" });
    saveAs(statsBlob, "network_statistics.json");
  };

  // ノード色
  const getNodeColor = useCallback((node) => {
    return communityColors[node.group % communityColors.length];
  }, [communityColors]);

  // エッジ色
  const getLinkColor = useCallback((link) => {
    const sourceNode = graphData.nodes.find(n => n.id === link.source);
    const targetNode = graphData.nodes.find(n => n.id === link.target);
    if (sourceNode && targetNode && sourceNode.group === targetNode.group) {
      return communityColors[sourceNode.group % communityColors.length];
    }
    return "#bbb";
  }, [graphData.nodes, communityColors]);

  // ノードサイズ
  const getNodeSize = useCallback((node) => {
    let value = 0;
    if (nodeSizeType === "revenue") {
      value = node.revenue || 0;
      const maxValue = Math.max(...graphData.nodes.map(n => n.revenue || 0));
      value = maxValue > 0 ? value / maxValue : 0;
    } else {
      value = node[nodeSizeType] || 0;
      const maxValue = Math.max(...graphData.nodes.map(n => n[nodeSizeType] || 0));
      value = maxValue > 0 ? value / maxValue : 0;
    }
    return nodeSize * (1 + value * 5);
  }, [nodeSizeType, nodeSize, graphData.nodes]);

  // ラベルサイズ
  const getLabelSize = useCallback((node) => {
    if (!showLabels) return 0;
    const value = node[nodeSizeType] || 0;
    return labelSize * (1 + value);
  }, [showLabels, labelSize, nodeSizeType]);

  // ネットワーク効果除去後の売上計算
  const totalRevenue = graphData.nodes.reduce((sum, n) => sum + (n.revenue || 0), 0);
  const maxCentrality = Math.max(...graphData.nodes.map(n => n[nodeSizeType] || 0), 1);
  const noNetworkRevenueSum = graphData.nodes.reduce((sum, n) => {
    const c_i = n[nodeSizeType] || 0;
    const r = n.revenue || 0;
    const noNet = r * (1 - alpha * (c_i / maxCentrality));
    return sum + noNet;
  }, 0);

  // autoProcessIdで自動描画
  React.useEffect(() => {
    if (!autoProcessId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/posdata/auto-download/${autoProcessId}/network`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('自動ネットワーク結果の取得に失敗しました');
        return res.json();
      })
      .then(data => {
        if (data.nodes && data.links) setGraphData(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [autoProcessId]);

  return (
    <section className="section network-container" style={{ position: "relative" }}>
      <h2 className="section-title">3. ネットワーク描画</h2>

      {/* ネットワーク効果による売上への影響表示 */}
      {graphData.nodes.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "linear-gradient(135deg, #fff3e0, #ffe0b2)", borderRadius: "16px", border: "2px solid #ff9800" }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#e65100", fontWeight: "600" }}>💰 ネットワーク効果による売上への影響</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h4 style={{ color: "#e65100", marginBottom: "0.5rem" }}>📊 売上統計</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li>💰 総売上: ¥{graphData.nodes.reduce((sum, n) => sum + (n.revenue || 0), 0).toLocaleString()}</li>
                <li>📈 平均売上: ¥{(graphData.nodes.reduce((sum, n) => sum + (n.revenue || 0), 0) / graphData.nodes.length).toLocaleString()}</li>
                <li>🏪 店舗数: {graphData.nodes.length}店</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: "#e65100", marginBottom: "0.5rem" }}>🌐 ネットワーク効果</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li>🎯 高中心性店舗: {graphData.nodes.filter(n => n.betweenness > 0.1).length}店</li>
                <li>💎 高中心性売上: ¥{graphData.nodes.filter(n => n.betweenness > 0.1).reduce((sum, n) => sum + (n.revenue || 0), 0).toLocaleString()}</li>
              </ul>
            </div>
          </div>
          <p style={{ color: "#e65100", fontSize: "14px", margin: 0 }}>
            💡 <strong>ネットワーク効果</strong>: 高中心性店舗（媒介中心性 > 0.1）の売上情報を表示しています。これらの店舗はネットワーク全体の売上に大きな影響を与える可能性があります。
          </p>
        </div>
      )}

      {/* ダウンロード機能の説明 */}
      {graphData.nodes.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "linear-gradient(135deg, #e3f2fd, #bbdefb)", borderRadius: "16px", border: "2px solid #2196f3" }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#1976d2", fontWeight: "600" }}>📥 ネットワークデータダウンロード</h3>
          <p style={{ marginBottom: "1rem", color: "#1565c0" }}>
            ネットワークのノード・リンクデータと統計情報をダウンロードできます。
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleDownloadNetworkData}
              style={{
                padding: "8px 16px",
                backgroundColor: "#2196f3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              📊 ノード・リンクデータをダウンロード
            </button>
            <button
              onClick={handleDownloadNetworkStats}
              style={{
                padding: "8px 16px",
                backgroundColor: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              📈 統計情報をダウンロード
            </button>
          </div>
        </div>
      )}

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
              ノードサイズ基準:
              <select
                value={nodeSizeType}
                onChange={(e) => setNodeSizeType(e.target.value)}
                style={{ marginLeft: "5px", padding: "0.3rem", border: "2px solid #e9ecef", borderRadius: "8px" }}
              >
                <option value="betweenness">媒介中心性</option>
                <option value="degree">次数中心性</option>
                <option value="closeness">近接中心性</option>
                <option value="eigenvector">固有ベクトル中心性</option>
                <option value="revenue">店舗売上</option>
              </select>
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px", fontWeight: "500" }}>
              📏 ノードサイズ:
              <input
                type="range"
                min="4"
                max="24"
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
                min="3"
                max="10"
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
                min="0.1"
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
      {graphData.nodes.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "#fffbe6", borderRadius: "16px", border: "2px solid #ffc107" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontWeight: 600, color: "#b8860b" }}>
              ネットワーク効果 α: {alpha}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={alpha}
                onChange={e => setAlpha(Number(e.target.value))}
                style={{ marginLeft: "10px", width: "200px" }}
              />
            </label>
          </div>
          <div style={{ fontWeight: 600, color: "#b8860b" }}>
            ネットワーク効果除去後の総売上: ¥{Math.round(noNetworkRevenueSum).toLocaleString()}（元: ¥{Math.round(totalRevenue).toLocaleString()}）
          </div>
          <div style={{ fontSize: "13px", color: "#b8860b", marginTop: "0.5rem" }}>
            ※ αを上げるほどネットワーク効果を強く除去した仮想売上になります。
          </div>
        </div>
      )}
      {/* リセットボタン */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 20 }}>
        <button
          onClick={() => fgRef.current && fgRef.current.zoomToFit(400, 40)}
          style={{ padding: "6px 16px", background: "#2196f3", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, boxShadow: "0 2px 8px #0002", cursor: "pointer" }}
        >
          リセット
        </button>
      </div>
      {graphData.nodes.length > 0 ? (
        <div style={{ height: "800px", border: "2px solid rgba(0, 123, 255, 0.1)", borderRadius: "16px", marginTop: "20px", background: "rgba(255, 255, 255, 0.8)", overflow: "hidden", position: "relative" }}>
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeColor={getNodeColor}
            linkColor={getLinkColor}
            nodeRelSize={getNodeSize}
            linkWidth={(link) => linkWidth * Math.pow(link.value || 0.00005, 0.3)}
            linkDirectionalParticles={0.5}
            ßlinkDirectionalParticleSpeed={(d) => (d.value || 0.5) * 0.01}
            enableNodeDrag={true}
            onNodeHover={setHoverNode}
            onNodeClick={setSelectedNode}
            nodeCanvasObject={(node, ctx, globalScale) => {
              // ノード（丸）
              const size = getNodeSize(node);
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
              ctx.fillStyle = getNodeColor(node);
              ctx.globalAlpha = 0.85;
              ctx.fill();
              ctx.globalAlpha = 1.0;
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 1.5;
              ctx.stroke();
              // 選択ノード枠
              if (selectedNode && node.id === selectedNode.id) {
                ctx.strokeStyle = "#ff9800";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI, false);
                ctx.stroke();
              }
              // ラベル
              if (showLabels) {
                const label = node.id;
                const fontSize = getLabelSize(node);
                ctx.font = `${fontSize}px Sans-Serif`;
                // ラベル背景
                const textWidth = ctx.measureText(label).width;
                ctx.fillStyle = "rgba(255,255,255,0.7)";
                ctx.fillRect(node.x - textWidth / 2 - 2, node.y - fontSize / 2, textWidth + 4, fontSize + 2);
                ctx.fillStyle = "black";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, node.x, node.y);
              }
            }}
          />
          {/* ホバーツールチップ（売上のみ） */}
          {hoverNode && (
            <TooltipForNode node={hoverNode} fgRef={fgRef} />
          )}
          {/* 選択ノード詳細 */}
          {selectedNode && (
            <div style={{ position: "absolute", right: 20, top: 100, background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 2px 8px #0002", zIndex: 30 }}>
              <h4>{selectedNode.id}</h4>
              <div>売上: ¥{Math.round(selectedNode.revenue || 0).toLocaleString()}</div>
              <div>媒介中心性: {selectedNode.betweenness}</div>
              <div>次数中心性: {selectedNode.degree}</div>
              <div>近接中心性: {selectedNode.closeness}</div>
              <div>固有ベクトル中心性: {selectedNode.eigenvector}</div>
              <button onClick={() => setSelectedNode(null)} style={{ marginTop: 8, padding: "4px 12px", background: "#eee", border: "none", borderRadius: 4, cursor: "pointer" }}>閉じる</button>
            </div>
          )}
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
});

// ノードホバーツールチップ（売上のみ）
function TooltipForNode({ node, fgRef }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  React.useEffect(() => {
    if (!fgRef.current || !node) return;
    // canvas座標→画面座標
    const { x, y } = fgRef.current.graph2ScreenCoords(node.x, node.y);
    setPos({ x, y });
  }, [node, fgRef]);
  if (!node) return null;
  return (
    <div style={{
      position: "absolute",
      left: pos.x + 20,
      top: pos.y + 20,
      background: "rgba(255,255,255,0.97)",
      border: "1px solid #ccc",
      borderRadius: 8,
      padding: "8px 12px",
      pointerEvents: "none",
      zIndex: 50,
      boxShadow: "0 2px 8px #0002"
    }}>
      <div><strong>{node.id}</strong></div>
      <div>売上: ¥{Math.round(node.revenue || 0).toLocaleString()}</div>
    </div>
  );
}

export default DrawNetwork;
