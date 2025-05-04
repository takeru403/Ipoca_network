// src/components/SlideSearch.js
import React, { useState } from "react";
import { fetchJSON } from "../api";

const presentationId = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds";

export default function SlideSearch({ setToast, logout }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      setToast("検索ワードを入力してください");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchJSON("/api/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      setResults(data);
    } catch (e) {
      if (e.status === 401) logout();
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ marginTop: "3rem" }}>
      <h2>🔍 スライド検索</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="例: 売上を上げる施策"
        style={{ width: "60%", padding: "0.5rem", marginRight: "0.7rem" }}
      />
      <button onClick={handleSearch} style={{ padding: "0.55rem 1.2rem" }}>
        検索
      </button>
      {loading && <p>⏳ 読み込み中…</p>}

      {results.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>📄 類似スライド一覧</h3>
          {results.map((s, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "1rem",
                marginBottom: "1rem",
                boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
                background: "#fff",
              }}
            >
              <strong>
                スライド {s.slide_index}（スコア: {s.score.toFixed(3)}）
              </strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.content}</p>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: "3rem" }}>📽 Googleスライド全体表示</h2>
      <iframe
        src={`https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false`}
        width="960"
        height="569"
        frameBorder="0"
        allowFullScreen
        title="Embedded Google Slides"
        style={{ borderRadius: 8, marginTop: "0.8rem" }}
      ></iframe>
    </section>
  );
}
