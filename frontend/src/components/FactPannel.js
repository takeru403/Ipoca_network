import React, { useState, useRef, useEffect } from "react";
import { fetchJSON } from "../api";

const FactPannel = ({ file }) => {
  const [narrationText, setNarrationText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  // fileがpropsで渡されたら自動でナレーション生成
  useEffect(() => {
    if (file) {
      handleGenerate(file);
    }
    // eslint-disable-next-line
  }, [file]);

  const handleGenerate = async (inputFile) => {
    if (!inputFile) return;
    setLoading(true);
    setNarrationText("");
    setAudioUrl("");
    const formData = new FormData();
    formData.append("file", inputFile);
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
      <h3>音声ナレーション</h3>
      {loading && <p>生成中...</p>}
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
      {!file && (
        <p style={{ color: '#888', marginTop: 20 }}>POSデータ前処理でファイルをアップロードすると、ここでナレーションが再生できます。</p>
      )}
    </section>
  );
};

export default FactPannel;
