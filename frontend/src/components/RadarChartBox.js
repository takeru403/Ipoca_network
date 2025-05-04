// src/components/RadarChartBox.js
import React, { useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
} from "recharts";
import { uploadFile } from "../api";

export default function RadarChartBox({ setToast, logout }) {
  const [radarData, setRadarData] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const { data, tenants } = await uploadFile(file);
      setRadarData(data);
      setTenants(tenants);
    } catch (e) {
      if (e.status === 401) logout();
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2>📊 レーダーチャート</h2>
      <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} />
      {loading && <p>⏳ 読み込み中…</p>}
      {radarData.length > 0 && (
        <RadarChart
          outerRadius={130}
          width={520}
          height={420}
          data={radarData}
          style={{ marginTop: "1rem" }}
        >
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" />
          <PolarRadiusAxis angle={30} domain={[0, 1]} />
          {tenants.map((t) => (
            <Radar
              key={t}
              name={t}
              dataKey={t}
              stroke="#1f77b4"
              fill="#1f77b4"
              fillOpacity={0.25}
            />
          ))}
          <Tooltip />
          <Legend />
        </RadarChart>
      )}
    </section>
  );
}
