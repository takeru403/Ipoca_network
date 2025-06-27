import React, { useState, useRef } from "react";
import { fetchJSON } from "../api";

const FactPannel = () => {
  const [file, setFile] = useState(null);
  const [narrationText, setNarrationText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setNarrationText("");
    setAudioUrl("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/factpanel/narration", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      const data = await res.json();
      setNarrationText(data.narration_text);
      setAudioUrl(`/api/factpanel/audio/${data.audio_file}`);
    } catch (e) {
      setNarrationText("ナレーション生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = "fact_narration.mp3";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="fact-narration-panel">
      <h2>📊 ファクトパネル（音声ナレーション）</h2>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleGenerate} disabled={loading || !file} style={{ marginLeft: 10 }}>
        {loading ? "生成中..." : "ナレーション生成"}
      </button>
      {narrationText && (
        <div style={{ marginTop: 20 }}>
          <h4>ナレーション内容</h4>
          <pre style={{ background: "#f8f8f8", padding: 10 }}>{narrationText}</pre>
        </div>
      )}
      {audioUrl && (
        <div style={{ marginTop: 20 }}>
          <audio ref={audioRef} src={audioUrl} controls style={{ width: "100%" }} />
          <div style={{ marginTop: 10 }}>
            <button onClick={handleDownload}>ダウンロード</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default FactPannel;
