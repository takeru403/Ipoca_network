import React, { useState, useEffect } from "react";

import { fetchJSON } from "../api";
import "../App.css";

export default function PosData({ setUploadedPosFile }) {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [processId, setProcessId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minSupport, setMinSupport] = useState(0.0001);
  const [maxLen, setMaxLen] = useState(2);

  // 必要な列の定義
  const requiredColumns = {
    "カード番号": "顧客のカード番号またはID",
    "利用日時": "購入日時",
    "利用金額": "購入金額",
    "ショップ名略称": "店舗名またはショップ名"
  };

  // ファイルアップロード処理
  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;
    setUploadedPosFile && setUploadedPosFile(uploadedFile);

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await fetch('/api/posdata/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `エラーが発生しました: ${response.status}`);
      }

      const data = await response.json();
      setFile(uploadedFile);
      setColumns(data.columns);

      // 列名の自動マッピング
      const autoMapping = {};
      Object.keys(requiredColumns).forEach(requiredCol => {
        const matchedCol = data.columns.find(col =>
          col.toLowerCase().includes(requiredCol.toLowerCase()) ||
          requiredCol.toLowerCase().includes(col.toLowerCase())
        );
        if (matchedCol) {
          autoMapping[matchedCol] = requiredCol;
        }
      });
      setColumnMapping(autoMapping);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 処理開始
  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('column_mapping', JSON.stringify(columnMapping));
    formData.append('min_support', minSupport.toString());
    formData.append('max_len', maxLen.toString());

    try {
      const response = await fetch('/api/posdata/process', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `エラーが発生しました: ${response.status}`);
      }

      const data = await response.json();
      setProcessId(data.process_id);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 処理状況の確認
  useEffect(() => {
    if (!processId) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/posdata/status/${processId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const status = await response.json();
          setProcessingStatus(status);

          if (status.status === 'completed' || status.status === 'failed') {
            setProcessId(null);
          }
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [processId]);

  // ダウンロード処理
  const handleDownload = async (filename) => {
    try {
      const response = await fetch(`/api/posdata/download/${filename}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      setError('ダウンロードに失敗しました');
    }
  };

  return (
    <section className="section posdata-container">
      <h2 className="section-title">1. POSデータ前処理</h2>

      {/* ファイルアップロード */}
      <div className="upload-area">
        <h3 style={{ margin: "0 0 1rem 0", color: "#007bff", fontWeight: "600" }}>📁 POSデータのアップロード</h3>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileUpload}
          className="file-input"
          style={{ marginBottom: "10px" }}
        />
        {loading && <p className="status-message">⏳ 読み込み中...</p>}
        {error && (
          <div className="error-message">
            エラー: {error}
          </div>
        )}
      </div>

      {/* 列名マッピング */}
      {columns.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "rgba(248, 249, 250, 0.8)", borderRadius: "16px", border: "1px solid rgba(0, 123, 255, 0.1)" }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#007bff", fontWeight: "600" }}>🔗 列名マッピング</h3>
          <p className="instruction-text">POSデータの列名を適切な意味にマッピングしてください</p>
          {Object.entries(requiredColumns).map(([requiredCol, description]) => (
            <div key={requiredCol} style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                {requiredCol} ({description}):
              </label>
              <select
                value={Object.keys(columnMapping).find(key => columnMapping[key] === requiredCol) || ""}
                onChange={(e) => {
                  const newMapping = { ...columnMapping };
                  // 既存のマッピングを削除
                  Object.keys(newMapping).forEach(key => {
                    if (newMapping[key] === requiredCol) {
                      delete newMapping[key];
                    }
                  });
                  // 新しいマッピングを追加
                  if (e.target.value) {
                    newMapping[e.target.value] = requiredCol;
                  }
                  setColumnMapping(newMapping);
                }}
                style={{ width: "300px" }}
              >
                <option value="">選択してください</option>
                {columns.map(col => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* パラメータ設定 */}
      {columns.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3>処理パラメータ</h3>
          <div style={{ marginBottom: "10px" }}>
            <label>
              最小サポート:
              <input
                type="number"
                min="0.0001"
                max="1"
                step="0.0001"
                value={minSupport}
                onChange={(e) => setMinSupport(parseFloat(e.target.value))}
                style={{ marginLeft: "10px" }}
              />
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              最大アイテムセット長:
              <input
                type="number"
                min="2"
                max="5"
                value={maxLen}
                onChange={(e) => setMaxLen(parseInt(e.target.value))}
                style={{ marginLeft: "10px" }}
              />
            </label>
          </div>
        </div>
      )}

      {/* 処理開始ボタン */}
      {columns.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={handleProcess}
            disabled={loading || Object.keys(columnMapping).length < 4}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "処理中..." : "前処理開始"}
          </button>
        </div>
      )}

      {/* 処理状況表示 */}
      {processingStatus && (
        <div style={{ marginBottom: "20px" }}>
          <h3>処理状況</h3>
          <div style={{ marginBottom: "10px" }}>
            <p>ステータス: {processingStatus.status}</p>
            <p>メッセージ: {processingStatus.message}</p>
            {processingStatus.progress !== undefined && (
              <div>
                <p>進捗: {processingStatus.progress}%</p>
                <div style={{
                  width: "100%",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "4px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${processingStatus.progress}%`,
                    height: "20px",
                    backgroundColor: "#4CAF50",
                    transition: "width 0.3s ease"
                  }}></div>
                </div>
              </div>
            )}
          </div>

          {/* 完了時のダウンロードボタン */}
          {processingStatus.status === 'completed' && processingStatus.filename && (
            <div>
              <p>処理結果:</p>
              <ul>
                <li>ルール数: {processingStatus.rules_count}</li>
                <li>ノード数: {processingStatus.nodes_count}</li>
                <li>エッジ数: {processingStatus.edges_count}</li>
              </ul>
              <button
                onClick={() => handleDownload(processingStatus.filename)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                結果をダウンロード
              </button>
            </div>
          )}

          {/* エラー時の表示 */}
          {processingStatus.status === 'failed' && (
            <div style={{ color: "red" }}>
              <p>エラー: {processingStatus.message}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
