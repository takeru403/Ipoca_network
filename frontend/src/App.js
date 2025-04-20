/****************************************************************************************
 * App.js – 完全版（ログイン + レーダーチャート + 類似スライド検索 + スライド埋め込み）
 *   - id / password = ipoca_test
 *   - 401 を検知して自動ログアウト
 *   - credentials:"include" を徹底
 *   - 簡潔なインラインスタイル & 最低限の CSS クラスで構成
 ****************************************************************************************/

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
import "./App.css"; // 必要に応じて調整

const presentationId = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds";

/* -------------------------------------------------- 便利関数 --------------------------------- */
const fetchJSON = async (url, opts = {}) => {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const body =
    res.headers.get("content-type")?.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text();
  if (!res.ok) {
    const msg = body?.error || body || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
};

const uploadFile = async (file) => {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload-json", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
};

/* --------------------------------------------- メインコンポーネント --------------------------- */
export default function App() {
  /* ----- 認証ステート ----- */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [authErr, setAuthErr] = useState("");

  /* ----- レーダーチャート ----- */
  const [radarData, setRadarData] = useState([]);
  const [tenants, setTenants] = useState([]);

  /* ----- スライド検索 ----- */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  /* ----- ステータス ----- */
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  /* --------------------------------- 認証ハンドラ --------------------------------- */
  const login = async () => {
    setAuthErr("");
    try {
      await fetchJSON("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pwd }),
      });
      setIsLoggedIn(true);
      setToast("ログインしました");
    } catch (e) {
      setAuthErr(e.message);
    }
  };

  const logout = async () => {
    try {
      await fetchJSON("/api/logout", { method: "POST" });
    } catch (_) {
      /* ignore */
    } finally {
      setIsLoggedIn(false);
      // 画面クリア
      setQuery("");
      setResults([]);
      setRadarData([]);
      setToast("ログアウトしました");
    }
  };

  /* --------------------------------- API 呼び出し --------------------------------- */
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

  /* --------------------------------- 未ログイン画面 --------------------------------- */
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h2>ログイン</h2>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="ユーザー名"
        />
        <input
          value={pwd}
          type="password"
          onChange={(e) => setPwd(e.target.value)}
          placeholder="パスワード"
        />
        <button onClick={login}>ログイン</button>
        {authErr && <p className="error">{authErr}</p>}
      </div>
    );
  }

  /* --------------------------------- ログイン後画面 --------------------------------- */
  return (
    <div style={{ fontFamily: "sans-serif", padding: "1.5rem" }}>
      {/* トップヘッダー */}
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>スライド検索 & データ可視化</h1>
        <button onClick={logout} style={{ padding: "0.4rem 1rem" }}>
          ログアウト
        </button>
      </header>

      {/* トースト */}
      {toast && (
        <div
          style={{
            background: "#333",
            color: "#fff",
            padding: "0.5rem 1rem",
            borderRadius: 6,
            marginTop: "1rem",
            display: "inline-block",
          }}
        >
          {toast}
        </div>
      )}

      {/* ローディング */}
      {loading && <p>⏳ 読み込み中…</p>}

      {/* ---- レーダーチャート ---- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>📊 レーダーチャート</h2>
        <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} />
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

      {/* ---- スライド検索 ---- */}
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
                  スライド {s.slide_index}（スコア: {s.score.toFixed(3)})
                </strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{s.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Google スライド埋め込み ---- */}
      <section style={{ marginTop: "3rem" }}>
        <h2>📽 Googleスライド全体表示</h2>
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
    </div>
  );
}
