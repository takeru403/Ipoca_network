import React, { useState, useEffect } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend
} from "recharts";
import { saveAs } from "file-saver";

const Cluster = () => {
  const [file, setFile] = useState(null);
  const [nClusters, setNClusters] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clusterNames, setClusterNames] = useState(null);
  const [radarData, setRadarData] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [preview, setPreview] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedClusters, setSelectedClusters] = useState([]);
  const [clusterCounts, setClusterCounts] = useState({});
  const [clusteredData, setClusteredData] = useState([]);

  // ファイルアップロード＆プレビュー取得
  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    setFile(f);
    setError(null);
    setPreview([]);
    setColumns([]);
    setSelectedColumns([]);
    setClusterNames(null);
    setRadarData(null);
    setSelectedCluster(null);
    setSelectedClusters([]);
    setClusterCounts({});
    setClusteredData([]);
    if (!f) return;
    const formData = new FormData();
    formData.append("file", f);
    try {
      const res = await fetch("/api/cluster/preview", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "プレビュー取得に失敗しました");
      }
      const data = await res.json();
      setPreview(data.preview);
      setColumns(data.columns);
      setSelectedColumns(data.columns); // デフォルト全選択
    } catch (e) {
      setError(e.message);
    }
  };

  // カラム選択
  const handleColumnCheck = (col) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  // クラスタリング実行
  const handleCluster = async () => {
    if (!file || selectedColumns.length === 0) return;
    setLoading(true);
    setError(null);
    setClusterNames(null);
    setRadarData(null);
    setSelectedCluster(null);
    setSelectedClusters([]);
    setClusterCounts({});
    setClusteredData([]);
    const formData = new FormData();
    formData.append("n_clusters", nClusters);
    formData.append("selected_columns", JSON.stringify(selectedColumns));
    formData.append("file", file);
    try {
      const res = await fetch("/api/cluster", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "クラスタリングに失敗しました");
      }
      const data = await res.json();
      setClusterNames(data.cluster_names);
      setRadarData(data.radar_chart_data);
      // 件数取得
      if (data.agg_df) {
        setClusteredData(data.agg_df);
        const counts = {};
        data.agg_df.forEach(row => {
          if (row["クラスタ名"]) {
            counts[row["クラスタ名"]] = (counts[row["クラスタ名"]] || 0) + 1;
          }
        });
        setClusterCounts(counts);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // クラスタ名リスト
  const clusterNameList = clusterNames ? Object.values(clusterNames) : [];

  // レーダーチャート用データをカラム選択で再生成
  const getRadarDataFromSelected = () => {
    if (!clusteredData.length || !selectedColumns.length) return [];
    // クラスタごとに平均値を計算
    const clusters = [...new Set(clusteredData.map(row => row["クラスタ名"]))];
    const data = [];
    selectedColumns.forEach(metric => {
      const row = { metric };
      clusters.forEach(cluster => {
        // クラスタごとの平均値
        const vals = clusteredData.filter(r => r["クラスタ名"] === cluster).map(r => Number(r[metric]) || 0);
        row[cluster] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : 0;
      });
      data.push(row);
    });
    return data;
  };

  // レーダーチャートデータをselectedColumnsで再生成
  useEffect(() => {
    if (clusteredData.length && selectedColumns.length) {
      setRadarData(getRadarDataFromSelected());
    }
    // eslint-disable-next-line
  }, [clusteredData, selectedColumns]);

  // クラスタ抽出API
  const handleLegendClick = (e) => {
    if (!e || !e.value) return;
    setSelectedCluster(e.value);
    fetch("/api/cluster/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cluster_name: e.value })
    })
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          // 選択クラスタのデータ件数を更新
          setClusterCounts(counts => ({ ...counts, [e.value]: data.data.length }));
        }
      })
      .catch(err => setError("抽出に失敗しました"));
  };

  // 複数クラスタ選択
  const handleClusterCheckbox = (name) => {
    setSelectedClusters((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // CSVダウンロード
  const handleDownloadCSV = () => {
    if (!selectedClusters.length || !clusteredData.length) return;
    // 選択したクラスタのデータのみ抽出
    const filtered = clusteredData.filter(row => selectedClusters.includes(row["クラスタ名"]));
    if (!filtered.length) return;
    // CSV変換
    const columns = Object.keys(filtered[0]);
    const csv = [columns.join(",")].concat(
      filtered.map(row => columns.map(col => `"${row[col] ?? ''}"`).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "selected_clusters.csv");
  };

  return (
    <section className="section cluster-container">
      <h2 className="section-title">2. 顧客属性クラスタリング</h2>
      <div className="upload-area">
        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", color: "#007bff" }}>
          🎯 クラスタ数:
          <input
            type="number"
            min={2}
            max={10}
            value={nClusters}
            onChange={e => setNClusters(Number(e.target.value))}
            style={{ width: 80, padding: "0.5rem", border: "2px solid #e9ecef", borderRadius: "8px", textAlign: "center" }}
          />
        </label>
      </div>
      <div style={{ marginBottom: 20 }}>
        <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
      </div>
      {/* データプレビューとカラム選択 */}
      {columns.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>カラム選択（クラスタリングに使う列を選んでください）</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            {columns.map((col) => (
              <label key={col} style={{ marginRight: 10 }}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(col)}
                  onChange={() => handleColumnCheck(col)}
                />
                {col}
              </label>
            ))}
          </div>
          <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #ccc", borderRadius: 4 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col} style={{ border: "1px solid #ccc", padding: 4 }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col} style={{ border: "1px solid #ccc", padding: 4 }}>{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={handleCluster}
          disabled={loading || !file || selectedColumns.length === 0}
          style={{ padding: "10px 20px", background: "#4CAF50", color: "white", border: "none", borderRadius: 4 }}
        >
          {loading ? "処理中..." : "クラスタリング実行"}
        </button>
      </div>
      {error && <div style={{ color: "red" }}>エラー: {error}</div>}
      {clusterNames && (
        <div style={{ marginBottom: 20 }}>
          <h3>クラスタ名・件数</h3>
          <ul>
            {Object.entries(clusterNames).map(([id, name]) => (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedClusters.includes(name)}
                    onChange={() => handleClusterCheckbox(name)}
                  />
                  <b>クラスタ{id}:</b> {name}（{clusterCounts[name] || 0}件）
                </label>
              </li>
            ))}
          </ul>
          <button
            onClick={handleDownloadCSV}
            disabled={!selectedClusters.length || !clusteredData.length}
            style={{ padding: "6px 16px", background: "#1976d2", color: "white", border: "none", borderRadius: 4 }}
          >
            選択クラスタをCSVダウンロード
          </button>
        </div>
      )}
      {radarData && radarData.length > 0 && (
        <div style={{ marginBottom: 20, position: "relative" }}>
          <h3>クラスタ特徴レーダーチャート</h3>
          <RadarChart
            cx={250}
            cy={200}
            outerRadius={130}
            width={520}
            height={420}
            margin={{ top: 50, right: 50, left: 50, bottom: 50 }}
            data={radarData}
          >
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
            <PolarRadiusAxis angle={30} domain={[0, 1]} />
            {clusterNameList.map((name, i) => (
              <Radar
                key={name}
                name={name}
                dataKey={name}
                stroke={`hsl(${i * 60}, 70%, 50%)`}
                fill={`hsl(${i * 60}, 70%, 50%)`}
                fillOpacity={0.3}
                isAnimationActive={false}
              />
            ))}
            <Tooltip />
            <Legend onClick={handleLegendClick} />
          </RadarChart>
          {selectedCluster && (
            <div style={{ marginTop: 10, color: '#1976d2' }}>
              選択中のクラスタ: <b>{selectedCluster}</b>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default Cluster;
