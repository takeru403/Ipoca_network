// frontend/src/components/RadarChartBox.js
import React, { useState } from "react";
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
import "../App.css";

export default function RadarChartBox({ setToast, logout }) {
  const [file, setFile] = useState(null);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [radarData, setRadarData] = useState([]);
  const [recommendResults, setRecommendResults] = useState([]);
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const annotations = [
    { label: "館内メディア", x: 200, y: 100 },
    { label: "売場連携", x: 75, y: 80 },
    { label: "レコメンド", x: 30, y: 170 },
    { label: "付加価値", x: 80, y: 280 },
    { label: "疑似体験コンテンツ", x: 200, y: 300 },
    { label: "CRM", x: 330, y: 220 },
    { label: "館外メディア", x: 340, y: 60 }
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

  return (
    <section className="radar-container">
      <h2 className="section-title">2. レーダーチャート</h2>

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

      {radarData.length > 0 && (
        <div className="radar-chart-wrapper">
          <RadarChart
            cx={260}
            cy={210}
            outerRadius={130}
            width={520}
            height={420}
            data={radarData}
          >
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
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
            {annotations.map((a, idx) => (
              <g
                key={idx}
                transform={`translate(${a.x},${a.y})`}
                style={{ pointerEvents: "all", cursor: "pointer" }}
                onClick={() => handleAnnotationClick(a.label)}
              >
                <rect
                  x={-((a.label.length * 9 + 10) / 2)}
                  y={-15}
                  rx={10}
                  ry={10}
                  width={a.label.length * 9 + 10}
                  height={30}
                  fill="#fff8c6"
                  stroke="#999"
                  strokeWidth={0.8}
                  opacity={0.65}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="#000"
                >
                  {a.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="custom-search">
        <h3>🔍 スライドを自由検索</h3>
        <input
          type="text"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder="検索ワードを入力"
          className="text-input"
        />
        <button onClick={handleCustomSearch} className="primary-button">
          検索
        </button>
      </div>

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
}
