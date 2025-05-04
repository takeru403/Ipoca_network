// src/components/RadarChartBox.js
import React, { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend
} from "recharts";
import { fetchJSON } from "../api";

export default function RadarChartBox({ setToast, logout }) {
  const [file, setFile] = useState(null);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [radarData, setRadarData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async () => {
    if (!file) return setToast("ファイルを選択してください。");
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-file", {
        method: "POST",
        body: formData,
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
    <section style={{ marginTop: "2rem" }}>
      <h2>📊 レーダーチャート</h2>

      <input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleFileUpload}>テナント選択</button>

      {tenantOptions.length > 0 && (
        <>
          <p>表示するテナント（最大5件）を選んでください：</p>
          <select
            multiple
            value={selectedTenants}
            onChange={(e) =>
              setSelectedTenants(Array.from(e.target.selectedOptions, (opt) => opt.value))
            }
            style={{ height: "8rem", width: "300px" }}
          >
            {tenantOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <br />
          <button onClick={fetchRadarData}>描画</button>
        </>
      )}

      {loading && <p>⏳ 読み込み中…</p>}

      {radarData.length > 0 && (
        <RadarChart outerRadius={130} width={520} height={420} data={radarData}>
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
              fillOpacity={0.2}
            />
          ))}
          <Tooltip />
          <Legend />
        </RadarChart>
      )}
    </section>
  );
}
