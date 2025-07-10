import React, { useState, useRef } from "react";

export default function SolutionVoiceModal({ ideaText, onClose }) {
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef(null);

  const handlePlayNarration = async () => {
    if (!ideaText) return;
    setAudioLoading(true);
    setAudioUrl("");
    setError("");
    try {
      const res = await fetch("/api/voice-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ideaText })
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
            <span className="note-tab active">ソリューション音声解説</span>
          </div>
          <button className="note-modal-close" onClick={onClose} title="閉じる">✖</button>
        </div>
        <div className="note-modal-content">
          <h2 className="section-title" style={{ fontSize: '1.3rem', marginBottom: 16 }}>AIソリューションアイディア音声解説</h2>
          <div className="section" style={{ padding: '1rem', marginBottom: 16, background: '#f8f9fa', borderRadius: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>要約対象のAIアイディア</div>
            <textarea
              className="text-input"
              value={ideaText || "(AIアイディアがありません)"}
              readOnly
              style={{ width: '100%', minHeight: 80, background: '#f8f9fa' }}
            />
          </div>
          <button
            className="primary-button"
            style={{ width: '100%' }}
            onClick={handlePlayNarration}
            disabled={audioLoading || !ideaText}
          >
            {audioLoading ? <span className="loading-spinner" /> : "🔊 音声で解説"}
          </button>
          {error && <div className="error-message">{error}</div>}
          {audioUrl && (
            <div style={{ marginTop: 24 }}>
              <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%' }} />
            </div>
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
        .primary-button {
          background: #007bff;
          color: #fff;
          border: none;
          padding: 0.7rem 1.2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .primary-button:disabled {
          background: #b0c4de;
          cursor: not-allowed;
        }
        .error-message {
          color: #d32f2f;
          margin-top: 1em;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
