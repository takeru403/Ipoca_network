// frontend/src/components/DrawNetwork.js
import React, { useState } from "react";
import "../App.css";

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
    <div className="network-container">
      <h2 className="section-title">1. 併売ネットワーク描画</h2>
      <div className="upload-area">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          className="file-input"
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="primary-button"
        >
          {loading ? "描画中..." : "描画"}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
      {imgSrc && (
        <div className="network-image-wrapper">
          <img src={imgSrc} alt="Network Graph" className="network-image" />
        </div>
      )}
    </div>
  );
}
