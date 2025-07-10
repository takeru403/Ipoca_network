import React, { useState, useRef, useEffect } from "react";
import { fetchJSON } from "../api";

const FactPannel = React.memo(({ file, ageColumn, minAge, maxAge }) => {
  const [narrationText, setNarrationText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [processedFiles, setProcessedFiles] = useState(new Set());
  const [fileHash, setFileHash] = useState("");
  const audioRef = useRef(null);

  // localStorageから処理済みファイルを読み込み
  useEffect(() => {
    const savedProcessedFiles = localStorage.getItem('factPannelProcessedFiles');
    if (savedProcessedFiles) {
      try {
        const parsed = JSON.parse(savedProcessedFiles);
        setProcessedFiles(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse processed files from localStorage:', e);
      }
    }
  }, []);

  // ファイルのハッシュ値を計算する関数
  const calculateFileHash = async (file) => {
    if (!file) return "";
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // fileがpropsで渡されたらハッシュ値を計算
  useEffect(() => {
    if (file) {
      calculateFileHash(file).then(hash => {
        setFileHash(hash);
      });
    } else {
      setFileHash("");
    }
  }, [file]);

  // ファイルが変更された場合は必ず自動実行（processedFilesの有無に関係なく）
  useEffect(() => {
    if (file && fileHash) {
      handleGenerate(file, fileHash, true); // force=trueで必ず生成
    }
  }, [fileHash]);

  const handleGenerate = async (inputFile, hash = null, force = false) => {
    if (!inputFile) return;

    const currentHash = hash || await calculateFileHash(inputFile);

    // 既に処理済みの場合はスキップ（force=trueなら無視して再生成）
    if (!force && processedFiles.has(currentHash)) {
      return;
    }

    setLoading(true);
    setNarrationText("");
    setAudioUrl("");

    const formData = new FormData();
    formData.append("file", inputFile);
    if (ageColumn) formData.append("age_column", ageColumn);
    if (minAge !== undefined) formData.append("min_age", minAge);
    if (maxAge !== undefined) formData.append("max_age", maxAge);

    try {
      const res = await fetch("/api/factpanel/narration", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      const data = await res.json();
      setNarrationText(data.narration_text);
      setAudioUrl(`/api/factpanel/audio/${data.audio_file}`);

      // 処理済みファイルとして記録
      const newProcessedFiles = new Set([...processedFiles, currentHash]);
      setProcessedFiles(newProcessedFiles);

      // localStorageに保存
      localStorage.setItem('factPannelProcessedFiles', JSON.stringify([...newProcessedFiles]));
    } catch (e) {
      setNarrationText("ナレーション生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 手動実行ボタンのハンドラー
  const handleManualGenerate = () => {
    if (file) {
      handleGenerate(file, fileHash, true); // force=trueで必ず再生成
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

      {file && (
        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={handleManualGenerate}
            disabled={loading}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px"
            }}
          >
            {loading ? "生成中..." : "ナレーション生成"}
          </button>
        </div>
      )}

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
});

export default FactPannel;
