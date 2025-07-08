import React, { useState, useMemo, useCallback } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import RadarChartBox from "./components/RadarChartBox";
import SlideSearch from "./components/SlideSearch";
import DrawNetwork from "./components/DrawNetwork";
import MindMap from "./components/MindMap";
import PosData from "./components/PosData";
import Cluster from "./components/Cluster";
import FactPannel from "./components/FactPannel";
import { fetchJSON } from "./api";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [showFactPanel, setShowFactPanel] = useState(true);
  const [showStudioPanel, setShowStudioPanel] = useState(true);
  const [showMindMap, setShowMindMap] = useState(false);
  const [uploadedPosFile, setUploadedPosFile] = useState(null);
  const [autoProcessId, setAutoProcessId] = useState(null);

  const logout = useCallback(async () => {
    try {
      await fetchJSON("/api/logout", { method: "POST", credentials: "include" });
    } catch (_) { }
    setIsLoggedIn(false);
    setToast("ログアウトしました");
  }, []);

  // メインコンテンツをメモ化して不要な再レンダリングを防ぐ
  const mainContent = useMemo(() => {
    if (showMindMap) {
      return (
        <div>
          <button
            onClick={() => setShowMindMap(false)}
            style={{
              margin: "1em 0",
              background: "linear-gradient(135deg, #e3f2fd, #bbdefb)",
              border: "2px solid #007bff",
              padding: "0.8rem 1.5rem",
              borderRadius: "12px",
              fontWeight: "600",
              color: "#007bff",
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(0, 123, 255, 0.2)"
            }}
          >
            ← マインドマップを閉じる
          </button>
          <MindMap />
        </div>
      );
    } else {
      return (
        <>
          {/* POSデータ前処理 */}
          <PosData setUploadedPosFile={setUploadedPosFile} onAutoProcessComplete={setAutoProcessId} />
          {/* クラスタリング */}
          <Cluster autoProcessId={autoProcessId} />
          {/* ネットワーク描画 */}
          <DrawNetwork autoProcessId={autoProcessId} />
          {/* レーダーチャート */}
          <RadarChartBox setToast={setToast} logout={logout} autoProcessId={autoProcessId} />
          {/* スライド検索 */}
          <SlideSearch setToast={setToast} logout={logout} />
        </>
      );
    }
  }, [showMindMap, autoProcessId]);

  // ファクトパネルをメモ化
  const factPanel = useMemo(() => (
    <aside className="fact-panel">
      <div className="panel-header">
        <h2 className="panel-title">📊 ファクトパネル</h2>
        <p className="panel-description">「1.POSデータ前処理」にアップロードしたデータのファクトに関して、音声ナレーションを行います。</p>
      </div>
      <div className="panel-content">
        <FactPannel file={uploadedPosFile} />
      </div>
    </aside>
  ), [uploadedPosFile]);

  // Studioパネルをメモ化
  const studioPanel = useMemo(() => (
    <aside className="studio-panel">
      <div className="panel-header">
        <h2 className="panel-title">🧠 ソリューションパネル</h2>
        <p className="panel-description">販促事例のアイデア、分析をここに記載できます。</p>
      </div>
      <div className="panel-content">
        <button
          className={`panel-button ${showMindMap ? 'active' : ''}`}
          onClick={() => setShowMindMap(true)}
        >
          ✅ マインドマップ
        </button>
        <button className="panel-button">
          🗂 音声スライド要約
        </button>
        <button className="panel-button">
          📖 ノート記事作成
        </button>
      </div>
    </aside>
  ), [showMindMap]);

  if (!isLoggedIn) {
    return <LoginForm onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">アスシル販促ソリューションスライド検索LLMツール</h1>
        <div className="header-controls">
          <button className="toggle-panel-button" onClick={() => setShowPanel(!showPanel)}>
            {showPanel ? "🔽 パネルを閉じる" : "🔼 パネルを開く"}
          </button>
          <button className="logout-button" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}

      {/* パネルトグルボタン */}
      <div className="panel-toggle-container">
        <button
          className="panel-toggle-left"
          onClick={() => setShowFactPanel(!showFactPanel)}
          title={showFactPanel ? "ファクトパネルを閉じる" : "ファクトパネルを開く"}
        >
          {showFactPanel ? "◀" : "▶"}
        </button>
        <button
          className="panel-toggle-right"
          onClick={() => setShowStudioPanel(!showStudioPanel)}
          title={showStudioPanel ? "Studioパネルを閉じる" : "Studioパネルを開く"}
        >
          {showStudioPanel ? "▶" : "◀"}
        </button>
      </div>

      <div className="main-layout">
        {/* ファクトパネル */}
        {showPanel && showFactPanel && factPanel}

        {/* メインコンテンツ */}
        <main className={`main-content ${showPanel && (showFactPanel || showStudioPanel) ? 'main-content-with-panels' : 'main-content-without-panels'}`}>
          {mainContent}
        </main>

        {/* Studioパネル */}
        {showPanel && showStudioPanel && studioPanel}
      </div>
    </div>
  );
}

export default App;
