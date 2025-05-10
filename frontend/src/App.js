import React, { useState } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import RadarChartBox from "./components/RadarChartBox";
import SlideSearch from "./components/SlideSearch";
import DrawNetwork from "./components/DrawNetwork";
import { fetchJSON } from "./api";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");

  const logout = async () => {
    try {
      await fetchJSON("/api/logout", { method: "POST", credentials: "include" });
    } catch (_) { }
    setIsLoggedIn(false);
    setToast("ログアウトしました");
  };

  if (!isLoggedIn) {
    return <LoginForm onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">アスシル販促ソリューションスライド検索LLMツール</h1>
        <button className="logout-button" onClick={logout}>
          ログアウト
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      {/* ネットワーク描画 */}
      <DrawNetwork />

      {/* レーダーチャート */}
      <RadarChartBox setToast={setToast} logout={logout} />

      {/* スライド検索 */}
      <SlideSearch setToast={setToast} logout={logout} />
    </div>
  );
}

export default App;
