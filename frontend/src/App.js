import React, { useState } from "react";

const presentationId = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds";

function App({ onLogout }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("ログインが必要です。");
        } else {
          throw new Error("検索に失敗しました");
        }
        return;
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      setError("検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    onLogout();
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>スライド類似検索システム</h1>

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={handleLogout} style={{ padding: "0.3rem 1rem", background: "#eee" }}>
          ログアウト
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="例: 売上を上げる施策"
        style={{ width: "60%", padding: "0.5rem", marginRight: "1rem" }}
      />
      <button onClick={handleSearch} style={{ padding: "0.5rem 1rem" }}>
        検索
      </button>

      {loading && <p>🔍 検索中...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {results.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>📄 類似スライド一覧</h2>
          {results.map((slide, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                backgroundColor: "#fff",
              }}
            >
              <h3>
                スライド {slide.slide_index}（スコア:{" "}
                {slide.score.toFixed(3)}）
              </h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{slide.content}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "3rem" }}>
        <h2>📽 Googleスライド全体表示</h2>
        <iframe
          src={`https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false`}
          width="960"
          height="569"
          frameBorder="0"
          allowFullScreen
          title="Embedded Google Slides"
          style={{ borderRadius: "8px", marginTop: "1rem" }}
        ></iframe>
      </div>
    </div>
  );
}

export default App;
