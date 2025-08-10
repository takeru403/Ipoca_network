// frontend/src/components/RadarChartBox.js
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
import { fetchJSON } from "../api";
import { saveAs } from "file-saver";
import "../App.css";

export default React.memo(function RadarChartBox({ setToast, logout, autoProcessId }) {
  const [file, setFile] = useState(null);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [radarData, setRadarData] = useState([]);
  const [recommendResults, setRecommendResults] = useState([]);
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const annotations = [
    { label: "館内メディア", x: 190, y: 80 },
    { label: "売場連携", x: 150, y: 120 },
    { label: "レコメンド", x: 120, y: 200 },
    { label: "付加価値", x: 180, y: 340 },
    { label: "疑似体験コンテンツ", x: 300, y: 340 },
    { label: "CRM", x: 380, y: 220 },
    { label: "館外メディア", x: 310, y: 80 }
  ];

  const handleAnnotationClick = async (label) => {
    try {
      const res = await fetchJSON("/api/search-slides", {
        method: "POST",
        body: JSON.stringify({ query: label }),
        credentials: "include"
      });
      setRecommendResults(res);
    } catch (e) {
      setToast(e.message);
    }
  };

  const handleCustomSearch = async () => {
    if (!customQuery.trim()) return;
    try {
      const res = await fetchJSON("/api/search-slides", {
        method: "POST",
        body: JSON.stringify({ query: customQuery }),
        credentials: "include"
      });
      setRecommendResults(res);
    } catch (e) {
      setToast(e.message);
    }
  };

  const handleFileUpload = async () => {
    if (!file) return setToast("ファイルを選択してください。");
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-file", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "アップロード失敗");
      setTenantOptions(json.tenants);
      setToast("ファイルをアップロードしました");
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRadarData = async () => {
    if (selectedTenants.length === 0 || selectedTenants.length > 5) {
      return setToast("テナントを1〜5件選択してください");
    }
    setLoading(true);
    try {
      const data = await fetchJSON("/api/fetch-radar", {
        method: "POST",
        body: JSON.stringify({ tenants: selectedTenants }),
        credentials: "include"
      });
      setRadarData(data.data);
    } catch (e) {
      if (e.status === 401) logout();
      setToast(e.message || "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // レーダーチャートデータのダウンロード
  const handleDownloadRadarData = () => {
    if (!radarData.length) return;

    // CSV形式でダウンロード
    const columns = ['metric', ...selectedTenants];
    const csv = [columns.join(',')].concat(
      radarData.map(row =>
        columns.map(col => `"${row[col] || ''}"`).join(',')
      )
    ).join('\n');

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "radar_chart_data.csv");
  };

  // レーダーチャート統計情報のダウンロード
  const handleDownloadRadarStats = () => {
    if (!radarData.length) return;

    const stats = {
      tenants_count: selectedTenants.length,
      metrics_count: radarData.length,
      tenants: selectedTenants,
      metrics: radarData.map(row => row.metric),
      tenant_stats: selectedTenants.map(tenant => {
        const values = radarData.map(row => parseFloat(row[tenant]) || 0);
        return {
          tenant: tenant,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          total: values.reduce((sum, val) => sum + val, 0)
        };
      }),
      metric_stats: radarData.map(row => {
        const values = selectedTenants.map(tenant => parseFloat(row[tenant]) || 0);
        return {
          metric: row.metric,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          total: values.reduce((sum, val) => sum + val, 0)
        };
      })
    };

    const statsJson = JSON.stringify(stats, null, 2);
    const statsBlob = new Blob([statsJson], { type: "application/json;charset=utf-8;" });
    saveAs(statsBlob, "radar_chart_statistics.json");
  };

  // 指標順を固定
  const radarMetrics = [
    "ユニーク客数",
    "売上",
    "平均頻度(日数/ユニーク客数)",
    "1日あたり購買金額",
    "日別合計媒介中心"
  ];

  // サーバーデータを指標順で並べ替え
  const orderedRadarData = radarMetrics.map(metric =>
    radarData.find(row => row.metric === metric) || { metric, ...Object.fromEntries(selectedTenants.map(t => [t, 0])) }
  );

  // ラベル日本語明示
  const metricLabelMap = {
    "ユニーク客数": "ユニーク客数",
    "売上": "売上",
    "平均頻度(日数/ユニーク客数)": "平均頻度(日数/ユニーク客数)",
    "1日あたり購買金額": "1日あたり購買金額",
    "日別合計媒介中心": "日別合計媒介中心"
  };

  // autoProcessIdで自動描画
  useEffect(() => {
    if (!autoProcessId) return;
    setLoading(true);
    // レーダーチャートデータ取得
    fetch(`/api/posdata/auto-download/${autoProcessId}/radar`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('自動レーダーチャート結果の取得に失敗しました');
        return res.json();
      })
      .then(data => {
        if (data.tenants) setTenantOptions(data.tenants);
        if (data.selected_tenants) setSelectedTenants(data.selected_tenants);
        if (data.radar_data) setRadarData(data.radar_data);
      })
      .catch(e => setToast(e.message))
      .finally(() => setLoading(false));
  }, [autoProcessId, setToast]);

  return (
    <section className="section radar-container">
      <h2 className="section-title">4. レーダーチャート</h2>

      <div className="upload-area">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          className="file-input"
        />
        <button onClick={handleFileUpload} className="primary-button">
          テナント選択
        </button>
      </div>

      {tenantOptions.length > 0 && (
        <>
          <p className="instruction-text">表示するテナント（最大5件）を選んでください：</p>
          <select
            multiple
            value={selectedTenants}
            onChange={(e) =>
              setSelectedTenants(Array.from(e.target.selectedOptions, (opt) => opt.value))
            }
            className="tenant-select"
          >
            {tenantOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button onClick={fetchRadarData} className="primary-button" style={{ marginTop: "1rem" }}>
            描画
          </button>
        </>
      )}

      {loading && <p className="status-message">⏳ 読み込み中…</p>}

      {/* ダウンロード機能 */}
      {radarData.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "linear-gradient(135deg, #f3e5f5, #e1bee7)", borderRadius: "16px", border: "2px solid #9c27b0" }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#7b1fa2", fontWeight: "600" }}>📥 レーダーチャートデータダウンロード</h3>
          <p style={{ marginBottom: "1rem", color: "#6a1b9a" }}>
            レーダーチャートのデータと統計情報をダウンロードできます。
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleDownloadRadarData}
              style={{
                padding: "8px 16px",
                backgroundColor: "#9c27b0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              📊 レーダーチャートデータをダウンロード
            </button>
            <button
              onClick={handleDownloadRadarStats}
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

      {orderedRadarData.length > 0 && (
        <div className="radar-chart-wrapper">
          <RadarChart
            cx={250}
            cy={200}
            outerRadius={130}
            width={520}
            height={420}
            margin={{ top: 50, right: 50, left: 50, bottom: 50 }}
            data={orderedRadarData}
          >
            <PolarGrid />
            <PolarAngleAxis
              dataKey="metric"
              tickFormatter={v => metricLabelMap[v] || v}
            />
            <PolarRadiusAxis angle={30} domain={[0, 1]} />
            {selectedTenants.map((t, i) => (
              <Radar
                key={t}
                name={t}
                dataKey={t}
                stroke={`hsl(${i * 60}, 70%, 50%)`}
                fill={`hsl(${i * 60}, 70%, 50%)`}
                fillOpacity={0.3}
              />
            ))}
            <Tooltip />
            <Legend />
          </RadarChart>
          <svg width={520} height={420} style={{ position: "absolute", pointerEvents: "none" }}>
            {annotations.map((a, idx) => {
              const paddingX = 24;
              const charWidth = 13;
              const rectWidth = a.label.length * charWidth + paddingX;
              return (
                <g
                  key={idx}
                  className="radar-annotation"
                  transform={`translate(${a.x},${a.y})`}
                  style={{ pointerEvents: "all", cursor: "pointer" }}
                  onClick={() => handleAnnotationClick(a.label)}
                >
                  <rect
                    className="radar-annotation-rect"
                    x={-(rectWidth / 2)}
                    y={-15}
                    rx={10}
                    ry={10}
                    width={rectWidth}
                    height={30}
                  />
                  <text
                    className="radar-annotation-text"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                  >
                    {a.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* <div className="custom-search"> */}
      {/* <h3>🔍 スライドを自由検索</h3> */}
      {/* <input
          type="text"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder="検索ワードを入力"
          className="text-input"
        /> */}
      {/* <button onClick={handleCustomSearch} className="primary-button">
          検索
        </button>
      </div> */}

      {recommendResults.length > 0 && (
        <div className="recommend-box">
          <h3>📄 関連スライド</h3>
          <ul>
            {recommendResults.map((res, i) => (
              <li key={i}>
                <strong>スライド #{res.slide_index}</strong><br />
                <span style={{ whiteSpace: "pre-wrap" }}>{res.content}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});
