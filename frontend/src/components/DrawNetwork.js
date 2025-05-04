// frontend/src/components/DrawNetwork.js
import React, { useState } from "react";

export default function DrawNetwork() {
  const [file, setFile] = useState(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/network", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error("ネットワーク描画に失敗しました");
      const blob = await res.blob();
      setImgSrc(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>📡 ネットワーク描画</h2>
      <input
        type="file"
        accept=".csv,.xlsx"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} disabled={!file || loading} style={{ marginLeft: "1rem" }}>
        描画
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {imgSrc && (
        <div style={{ marginTop: "1.5rem" }}>
          <img src={imgSrc} alt="Network Graph" style={{ maxWidth: "100%" }} />
        </div>
      )}
    </div>
  );
}
