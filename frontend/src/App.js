import React, { useState } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import RadarChartBox from "./components/RadarChartBox";
import SlideSearch from "./components/SlideSearch";
import DrawNetwork from "./components/DrawNetwork";
import MindMap from "./components/MindMap";
import { fetchJSON } from "./api";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [showMindMap, setShowMindMap] = useState(false);

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

        <button className="toggle-panel-button" onClick={() => setShowPanel(!showPanel)}>
          {showPanel ? "パネルを閉じる" : "パネルを開く"}
        </button>
        <button className="logout-button" onClick={logout}>
          ログアウト
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      {showPanel && (
        <aside className="studio-panel">
          <h2>🧠 Studioパネル</h2>
          <p>販促事例のアイデア、分析をここに記載できます。</p>
          <ul>
            <li>
              <button
                onClick={() => setShowMindMap(true)}
                style={{
                  background: showMindMap ? "#edf5ff" : undefined,
                  fontWeight: showMindMap ? "bold" : undefined,
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "8px"
                }}
              >
                ✅ マインドマップ
              </button>
            </li>
            <li>🗂 音声スライド要約</li>
            <li>📖 ノート記事作成 </li>
          </ul>
        </aside>
      )
      }

      <main className="main-content">
        {showMindMap ? (
          <div>
            <button
              onClick={() => setShowMindMap(false)}
              style={{
                margin: "1em 0",
                background: "#d3e3fd",
                border: "none",
                padding: "6px 16px",
                borderRadius: "8px",
                fontWeight: "bold"
              }}
            >
              マインドマップを閉じる
            </button>
            <MindMap />
          </div>
        ) : (
          <>
            {/* ネットワーク描画 */}
            < DrawNetwork />

            {/* レーダーチャート */}
            < RadarChartBox setToast={setToast} logout={logout} />

            {/* スライド検索 */}
            <SlideSearch setToast={setToast} logout={logout} />
          </>
        )}
      </main>
    </div >
  );
}

export default App;
