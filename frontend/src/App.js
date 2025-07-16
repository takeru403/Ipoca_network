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
import CreateNote from "./components/CreateNote";
import { fetchJSON } from "./api";
import SolutionVoiceModal from "./components/SolutionVoiceModal";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [showFactPanel, setShowFactPanel] = useState(true);
  const [showStudioPanel, setShowStudioPanel] = useState(true);
  const [showMindMap, setShowMindMap] = useState(false);
  const [uploadedPosFile, setUploadedPosFile] = useState(null);
  const [autoProcessId, setAutoProcessId] = useState(null);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [showSolutionVoice, setShowSolutionVoice] = useState(false);
  const [latestIdea, setLatestIdea] = useState("");
  const [ageColumn, setAgeColumn] = useState("");
  const [minAge, setMinAge] = useState(0);
  const [maxAge, setMaxAge] = useState(120);

  const logout = useCallback(async () => {
    try {
      await fetchJSON("/api/logout", { method: "POST", credentials: "include" });
    } catch (_) { }
    setIsLoggedIn(false);
    setToast("ログアウトしました");
  }, []);

  // CreateNoteでAIアイディア内容をAppに渡す
  const handleIdeaGenerated = (idea) => {
    setLatestIdea(idea);
  };

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
          <PosData setUploadedPosFile={setUploadedPosFile} onAutoProcessComplete={setAutoProcessId}
            ageColumn={ageColumn} setAgeColumn={setAgeColumn} minAge={minAge} setMinAge={setMinAge} maxAge={maxAge} setMaxAge={setMaxAge}
          />
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
  }, [showMindMap, autoProcessId, ageColumn, minAge, maxAge, logout]);

  // ファクトパネルをメモ化
  const factPanel = useMemo(() => (
    <aside className="fact-panel">
      <div className="panel-header">
        <h2 className="panel-title">📊 ファクトパネル</h2>
        <p className="panel-description">「1.POSデータ前処理」にアップロードしたデータのファクトに関して、音声ナレーションを行います。</p>
      </div>
      <div className="panel-content">
        <FactPannel file={uploadedPosFile} ageColumn={ageColumn} minAge={minAge} maxAge={maxAge} />
      </div>
    </aside>
  ), [uploadedPosFile, ageColumn, minAge, maxAge]);

  // Studioパネルをメモ化
  const studioPanel = useMemo(() => (
    <aside className="studio-panel">
      <div className="panel-header">
        <h2 className="panel-title">🧠 ソリューションパネル</h2>
        <p className="panel-description">販促事例のアイディア、分析をここに記載できます。</p>
      </div>
      <div className="panel-content">
        <button className="panel-button" onClick={() => setShowCreateNote(true)}>
          📖 AIソリューションアイディア出し
        </button>
        <button
          className={`panel-button ${showMindMap ? 'active' : ''}`}
          onClick={() => setShowMindMap(true)}
        >
          ✅ マインドマップ
        </button>
        <button
          className="panel-button"
          onClick={() => setShowSolutionVoice(true)}
          disabled={!latestIdea}
        >
          🗂 ソリューション音声解説
        </button>
      </div>
    </aside>
  ), [showMindMap, latestIdea]);

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
      {showCreateNote && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <CreateNote
            onClose={() => setShowCreateNote(false)}
            onShowMindMap={() => {
              setShowCreateNote(false);
              setShowMindMap(true);
            }}
            onIdeaGenerated={handleIdeaGenerated}
          />
        </div>
      )}
      {showSolutionVoice && (
        <SolutionVoiceModal
          ideaText={latestIdea}
          onClose={() => setShowSolutionVoice(false)}
        />
      )}
    </div>
  );
}

export default App;
