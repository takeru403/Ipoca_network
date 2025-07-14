import React, { useState, useRef, useEffect } from "react";

const defaultCategories = ["飲料", "菓子", "日用品", "その他"];
const metrics = ["ユニーク客数", "売上", "平均頻度(日数/ユニーク客数)", "1日あたり購買金額", "日別合計媒介中心"];

export default function CreateNote({ onClose, onShowMindMap, onIdeaGenerated, processId }) {
  const [tab, setTab] = useState("improve");
  const [categories, setCategories] = useState(defaultCategories);
  const [category, setCategory] = useState(defaultCategories[0]);
  const [metric, setMetric] = useState(metrics[0]);
  const [categoryA, setCategoryA] = useState(defaultCategories[0]);
  const [categoryB, setCategoryB] = useState(defaultCategories[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [generatingMindMap, setGeneratingMindMap] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef(null);

  // カテゴリリストをAPIから取得
  useEffect(() => {
    if (!processId) return;
    // /api/posdata/auto-status/<process_id> からカテゴリリストを取得
    fetch(`/api/posdata/auto-status/${processId}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.category && Array.isArray(data.category) && data.category.length > 0) {
          setCategories(data.category);
          setCategory(data.category[0]);
          setCategoryA(data.category[0]);
          setCategoryB(data.category[1] || data.category[0]);
        } else {
          setCategories(defaultCategories);
          setCategory(defaultCategories[0]);
          setCategoryA(defaultCategories[0]);
          setCategoryB(defaultCategories[1]);
        }
      })
      .catch(() => {
        setCategories(defaultCategories);
        setCategory(defaultCategories[0]);
        setCategoryA(defaultCategories[0]);
        setCategoryB(defaultCategories[1]);
      });
  }, [processId]);

  const improvePrompt = `「${category}」カテゴリの「${metric}」指標を改善するための販促企画を考えてください。`;
  const networkPrompt = `「${categoryA}」カテゴリと「${categoryB}」カテゴリを回遊させるための販促企画を考えてください。`;

  const handleGenerateIdea = async () => {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/obsidian/generate-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, metric })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "エラーが発生しました");
      } else {
        setResult(data.idea);
        if (onIdeaGenerated) onIdeaGenerated(data.idea);
      }
    } catch (e) {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNetworkIdea = async () => {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/obsidian/generate-network-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryA, categoryB })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "エラーが発生しました");
      } else {
        setResult(data.idea);
        if (onIdeaGenerated) onIdeaGenerated(data.idea);
      }
    } catch (e) {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMindMap = async () => {
    if (!result) return;

    setGeneratingMindMap(true);
    try {
      const title = tab === 'improve' ? `${category}の${metric}改善アイディア` : `${categoryA}×${categoryB}回遊促進アイディア`;

      const res = await fetch("/api/mindmap/generate-from-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_idea: result,
          title: title
        })
      });

      if (res.ok) {
        // マインドマップ表示
        onShowMindMap && onShowMindMap();
        onClose();
      } else {
        setError("マインドマップ生成に失敗しました");
      }
    } catch (e) {
      setError("マインドマップ生成エラーが発生しました");
    } finally {
      setGeneratingMindMap(false);
    }
  };

  const handlePlayNarration = async () => {
    if (!result) return;
    setAudioLoading(true);
    setAudioUrl("");
    try {
      const res = await fetch("/api/voice-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result })
      });
      if (!res.ok) {
        setError("音声生成に失敗しました");
        setAudioLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play();
        }
      }, 100);
    } catch (e) {
      setError("音声生成エラーが発生しました");
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className="note-modal-overlay">
      <div className="note-modal">
        <div className="note-modal-header">
          <div className="note-modal-tabs">
            <button
              className={`note-tab ${tab === 'improve' ? 'active' : ''}`}
              onClick={() => setTab('improve')}
            >
              指標改善
            </button>
            <button
              className={`note-tab ${tab === 'network' ? 'active' : ''}`}
              onClick={() => setTab('network')}
            >
              当日併売・ネットワーク
            </button>
          </div>
          <button className="note-modal-close" onClick={onClose} title="閉じる">✖</button>
        </div>
        <div className="note-modal-content">
          {tab === 'improve' ? (
            <>
              <h2 className="section-title" style={{ fontSize: '1.3rem', marginBottom: 16 }}>指標改善の生成AIアイディア出し</h2>
              <div className="upload-area" style={{ marginBottom: 16 }}>
                <label style={{ minWidth: 80 }}>カテゴリ名</label>
                <select className="tenant-select" value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label style={{ minWidth: 80 }}>指標名</label>
                <select className="tenant-select" value={metric} onChange={e => setMetric(e.target.value)}>
                  {metrics.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="section" style={{ padding: '1rem', marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>プロンプト例</div>
                <textarea
                  className="text-input"
                  value={improvePrompt}
                  readOnly
                  style={{ width: '100%', minHeight: 60, background: '#f8f9fa' }}
                />
              </div>
              <button className="primary-button" style={{ width: '100%' }} onClick={handleGenerateIdea} disabled={loading}>
                {loading ? <span className="loading-spinner" /> : "AIにアイディアを出してもらう"}
              </button>
              {error && <div className="error-message">{error}</div>}
              {result && (
                <div className="idea-result-container">
                  <div className="idea-result-header">
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>AIによる販促企画アイディア</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="idea-copy-button"
                        onClick={() => navigator.clipboard.writeText(result)}
                        title="クリップボードにコピー"
                      >
                        📋 コピー
                      </button>
                      <button
                        className="idea-mindmap-button"
                        onClick={handleGenerateMindMap}
                        disabled={generatingMindMap}
                        title="マインドマップとして表示"
                      >
                        {generatingMindMap ? <span className="loading-spinner" /> : "🧠 マインドマップ"}
                      </button>
                      <button
                        className="idea-audio-button"
                        onClick={handlePlayNarration}
                        disabled={audioLoading}
                        title="音声で解説"
                      >
                        {audioLoading ? <span className="loading-spinner" /> : "🔊 音声で解説"}
                      </button>
                    </div>
                  </div>
                  <div className="idea-result-content">
                    <div style={{ whiteSpace: 'pre-line' }}>{result}</div>
                    {audioUrl && (
                      <audio ref={audioRef} src={audioUrl} controls style={{ marginTop: 16, width: '100%' }} />
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="section-title" style={{ fontSize: '1.3rem', marginBottom: 16 }}>当日併売・ネットワークの生成AIアイディア出し</h2>
              <div className="upload-area" style={{ marginBottom: 16 }}>
                <label style={{ minWidth: 80 }}>カテゴリ名A</label>
                <select className="tenant-select" value={categoryA} onChange={e => setCategoryA(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label style={{ minWidth: 80 }}>カテゴリ名B</label>
                <select className="tenant-select" value={categoryB} onChange={e => setCategoryB(e.target.value)}>
                  {categories.filter(c => c !== categoryA).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="section" style={{ padding: '1rem', marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>プロンプト例</div>
                <textarea
                  className="text-input"
                  value={networkPrompt}
                  readOnly
                  style={{ width: '100%', minHeight: 60, background: '#f8f9fa' }}
                />
              </div>
              <button className="primary-button" style={{ width: '100%' }} onClick={handleGenerateNetworkIdea} disabled={loading}>
                {loading ? <span className="loading-spinner" /> : "AIにアイディアを出してもらう"}
              </button>
              {error && <div className="error-message">{error}</div>}
              {result && (
                <div className="idea-result-container">
                  <div className="idea-result-header">
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>AIによる回遊促進アイディア</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="idea-copy-button"
                        onClick={() => navigator.clipboard.writeText(result)}
                        title="クリップボードにコピー"
                      >
                        📋 コピー
                      </button>
                      <button
                        className="idea-mindmap-button"
                        onClick={handleGenerateMindMap}
                        disabled={generatingMindMap}
                        title="マインドマップとして表示"
                      >
                        {generatingMindMap ? <span className="loading-spinner" /> : "🧠 マインドマップ"}
                      </button>
                      <button
                        className="idea-audio-button"
                        onClick={handlePlayNarration}
                        disabled={audioLoading}
                        title="音声で解説"
                      >
                        {audioLoading ? <span className="loading-spinner" /> : "🔊 音声で解説"}
                      </button>
                    </div>
                  </div>
                  <div className="idea-result-content">
                    <div style={{ whiteSpace: 'pre-line' }}>{result}</div>
                    {audioUrl && (
                      <audio ref={audioRef} src={audioUrl} controls style={{ marginTop: 16, width: '100%' }} />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        .note-modal-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.3);
          z-index: 2000;
          display: flex; align-items: center; justify-content: center;
        }
        .note-modal {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          max-width: 520px;
          width: 95vw;
          max-height: 90vh;
          padding: 0;
          overflow: hidden;
          animation: fadeIn 0.2s;
          display: flex;
          flex-direction: column;
        }
        .note-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(90deg, #e3f2fd, #bbdefb);
          padding: 0.8rem 1.2rem 0.5rem 1.2rem;
          border-bottom: 1px solid #e9ecef;
          flex-shrink: 0;
        }
        .note-modal-tabs {
          display: flex;
          gap: 0.5rem;
        }
        .note-tab {
          background: none;
          border: none;
          font-size: 1rem;
          font-weight: 500;
          color: #007bff;
          padding: 0.5rem 1.2rem;
          border-radius: 8px 8px 0 0;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .note-tab.active {
          background: #fff;
          color: #0056b3;
          font-weight: 700;
          border-bottom: 2px solid #007bff;
        }
        .note-modal-close {
          background: none;
          border: none;
          font-size: 1.3rem;
          color: #888;
          cursor: pointer;
          margin-left: 1rem;
        }
        .note-modal-content {
          padding: 2rem 1.5rem 1.5rem 1.5rem;
          overflow-y: auto;
          flex: 1;
        }
        .idea-result-container {
          margin-top: 24px;
          background: linear-gradient(135deg, rgba(248, 249, 250, 0.9), rgba(233, 236, 239, 0.9));
          border-radius: 16px;
          border: 1px solid rgba(0, 123, 255, 0.1);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }
        .idea-result-header {
          padding: 1rem 1.5rem;
          background: rgba(0, 123, 255, 0.1);
          border-bottom: 1px solid rgba(0, 123, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .idea-copy-button, .idea-mindmap-button {
          background: rgba(0, 123, 255, 0.8);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        .idea-copy-button:hover, .idea-mindmap-button:hover {
          background: rgba(0, 123, 255, 1);
        }
        .idea-mindmap-button {
          background: rgba(40, 167, 69, 0.8);
        }
        .idea-mindmap-button:hover {
          background: rgba(40, 167, 69, 1);
        }
        .idea-result-content {
          padding: 1.5rem;
          max-height: 300px;
          overflow-y: auto;
          line-height: 1.6;
        }
        .idea-result-content::-webkit-scrollbar {
          width: 8px;
        }
        .idea-result-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .idea-result-content::-webkit-scrollbar-thumb {
          background: rgba(0, 123, 255, 0.5);
          border-radius: 4px;
        }
        .idea-result-content::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 123, 255, 0.7);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .idea-audio-button {
          background: rgba(255, 193, 7, 0.8);
          color: #333;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        .idea-audio-button:hover {
          background: rgba(255, 193, 7, 1);
        }
      `}</style>
    </div>
  );
}
