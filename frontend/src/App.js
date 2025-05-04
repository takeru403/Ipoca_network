import React, { useState } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import RadarChartBox from "./components/RadarChartBox";
import SlideSearch from "./components/SlideSearch";
import DrawNetwork from "./components/DrawNetwork";  // ← ★追加
import { fetchJSON } from "./api";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");

  const logout = async () => {
    try {
      await fetchJSON("/api/logout", { method: "POST" });
    } catch (_) { }
    setIsLoggedIn(false);
    setToast("ログアウトしました");
  };

  if (!isLoggedIn) {
    return <LoginForm onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>スライド検索 & データ可視化</h1>
        <button onClick={logout} style={{ padding: "0.4rem 1rem" }}>
          ログアウト
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      {/* ネットワーク描画セクション */}
      <DrawNetwork />

      {/* レーダーチャート */}
      <RadarChartBox setToast={setToast} logout={logout} />

      {/* スライド検索 */}
      <SlideSearch setToast={setToast} logout={logout} />
    </div>
  );
}

export default App;
