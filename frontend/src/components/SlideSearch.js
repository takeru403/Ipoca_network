// src/components/SlideSearch.js
import React, { useState } from "react";
import { fetchJSON } from "../api";
import "../App.css";

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
        credentials: "include",
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
    <section className="slide-search-container">
      <h2 className="section-title">3. スライド検索</h2>

      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例: 売上を上げる施策"
          className="text-input"
        />
        <button onClick={handleSearch} className="primary-button">
          検索
        </button>
      </div>

      {loading && <p className="status-message">⏳ 読み込み中…</p>}

      {results.length > 0 && (
        <div className="search-results">
          <h3>📄 類似スライド一覧</h3>
          {results.map((s, idx) => (
            <div key={idx} className="result-card">
              <strong>スライド {s.slide_index}（スコア: {s.score.toFixed(3)}）</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.content}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">📽 Googleスライド全体表示</h2>
      <iframe
        src={`https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false`}
        width="960"
        height="569"
        frameBorder="0"
        allowFullScreen
        title="Embedded Google Slides"
        className="slide-iframe"
      ></iframe>
    </section>
  );
}
