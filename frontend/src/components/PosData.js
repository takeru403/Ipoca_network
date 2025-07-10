import React, { useState, useEffect } from "react";

import { fetchJSON } from "../api";
import "../App.css";

// 共通の処理状況表示コンポーネント
function StatusBox({ status, onDownload, onDownloadClustering, isAuto, handleAutoDownload }) {
  if (!status) return null;
  const isCompleted = status.status === 'completed';
  const isFailed = status.status === 'failed';
  const resultData = status.result_data || {};
  return (
    <div style={{ marginBottom: "20px", padding: "1.5rem", background: isAuto ? "rgba(248, 249, 250, 0.9)" : "rgba(248, 249, 250, 0.8)", borderRadius: "16px", border: isAuto ? "2px solid #28a745" : "1px solid #6c757d" }}>
      <h3 style={{ margin: "0 0 1rem 0", color: isAuto ? "#28a745" : "#6c757d", fontWeight: "600" }}>{isAuto ? "🔄 自動処理状況" : "📊 手動処理状況"}</h3>
      <div style={{ marginBottom: "10px" }}>
        <p><strong>ステータス:</strong> {status.status}</p>
        <p><strong>現在の処理:</strong> {status.current_step || "-"}</p>
        <p><strong>メッセージ:</strong> {status.message}</p>
        {status.progress !== undefined && (
          <div>
            <p><strong>進捗:</strong> {status.progress}%</p>
            <div style={{
              width: "100%",
              backgroundColor: isAuto ? "#e9ecef" : "#f0f0f0",
              borderRadius: "8px",
              overflow: "hidden",
              height: "24px"
            }}>
              <div style={{
                width: `${status.progress}%`,
                height: "100%",
                backgroundColor: isAuto ? "#28a745" : "#6c757d",
                transition: "width 0.5s ease",
                borderRadius: "8px"
              }}></div>
            </div>
          </div>
        )}
        {status.processing_time && (
          <p><strong>処理時間:</strong> {status.processing_time.toFixed(2)}秒</p>
        )}
      </div>
      {/* 完了時の結果表示とダウンロードボタン（自動・手動共通） */}
      {isCompleted && (resultData.pos_data || status.filename) && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: isAuto ? "rgba(40, 167, 69, 0.1)" : "rgba(40, 167, 69, 0.05)", borderRadius: "8px" }}>
          <h4 style={{ color: isAuto ? "#28a745" : "#6c757d", marginBottom: "1rem" }}>✅ 処理完了</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h5>POSデータ前処理結果:</h5>
              <ul>
                <li>ルール数: {resultData.pos_data ? resultData.pos_data.rules_count : status.rules_count}</li>
                <li>ノード数: {resultData.pos_data ? resultData.pos_data.nodes_count : status.nodes_count}</li>
                <li>エッジ数: {resultData.pos_data ? resultData.pos_data.edges_count : status.edges_count}</li>
              </ul>
              <button
                onClick={() => {
                  if (isAuto && handleAutoDownload) {
                    handleAutoDownload('pos');
                  } else if (onDownload) {
                    onDownload(status.filename);
                  }
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                📥 POSデータ結果をダウンロード
              </button>
            </div>
            <div>
              <h5>クラスタリング結果:</h5>
              <ul>
                <li>クラスタ数: {resultData.clustering_data ? Object.keys(resultData.clustering_data.cluster_names || {}).length : "-"}</li>
                <li>処理時間: {resultData.processing_time ? resultData.processing_time.toFixed(2) : status.processing_time ? status.processing_time.toFixed(2) : "-"}秒</li>
              </ul>
              <button
                onClick={() => {
                  if (isAuto && handleAutoDownload) {
                    handleAutoDownload('clustering');
                  } else if (onDownloadClustering) {
                    onDownloadClustering(status.cluster_filename);
                  }
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                📥 クラスタリング結果をダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
      {/* エラー時の表示 */}
      {isFailed && (
        <div style={{ color: "red", padding: "1rem", background: "rgba(220, 53, 69, 0.1)", borderRadius: "8px" }}>
          <p><strong>エラー:</strong> {status.message}</p>
        </div>
      )}
    </div>
  );
}

export default React.memo(function PosData({ setUploadedPosFile, onProcessComplete, onAutoProcessComplete, ageColumn, setAgeColumn, minAge, setMinAge, maxAge, setMaxAge }) {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [processId, setProcessId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minSupport, setMinSupport] = useState(0.0001);
  const [maxLen, setMaxLen] = useState(2);

  // 自動処理用の状態
  const [autoProcessId, setAutoProcessId] = useState(null);
  const [autoProcessingStatus, setAutoProcessingStatus] = useState(null);
  const [autoLoading, setAutoLoading] = useState(false);

  // 年齢パラメータはpropsで管理

  // 必要な列の定義
  const requiredColumns = {
    "カード番号": "顧客のカード番号またはID",
    "利用日時": "購入日時",
    "利用金額": "購入金額",
    "ショップ名略称": "店舗名またはショップ名",
    "カテゴリ": "商品カテゴリや分類（任意）",
    "年齢": "顧客の年齢（任意）"
  };

  // ファイルアップロード処理
  const handleFileUpload = async (event) => {
    // 状態リセット
    setProcessingStatus(null);
    setAutoProcessingStatus(null);
    setFile(null);
    setColumns([]);
    setColumnMapping({});
    setProcessId(null);
    setAutoProcessId(null);
    setError(null);

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

      // LLMによる列名マッピング取得
      try {
        const llmRes = await fetch('/api/posdata/llm-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columns: data.columns }),
          credentials: 'include'
        });
        if (llmRes.ok) {
          const llmData = await llmRes.json();
          // 1つの日本語名に1カラムだけ割り当てる
          const mapping = llmData.mapping || {};
          const usedJpNames = new Set();
          const uniqueMapping = {};
          for (const [col, jp] of Object.entries(mapping)) {
            if (!usedJpNames.has(jp)) {
              uniqueMapping[col] = jp;
              usedJpNames.add(jp);
            }
            // 2つ目以降はスキップ
          }
          setColumnMapping(uniqueMapping);
        } else {
          // LLM失敗時は従来の部分一致マッピング
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
        }
      } catch (e) {
        // LLM APIエラー時も部分一致マッピング
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
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 自動処理開始
  const handleAutoProcess = async () => {
    if (!file) return;

    setAutoLoading(true);
    setError(null);
    // 自動処理状況のみ表示、手動処理状況は消す
    setAutoProcessingStatus(null);
    setProcessingStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/posdata/auto-process', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `エラーが発生しました: ${response.status}`);
      }

      const data = await response.json();
      setAutoProcessId(data.process_id);
      setAutoProcessingStatus({ status: 'processing', message: '自動処理を開始しました', progress: 0 });
      setProcessingStatus(null); // 手動状況は消す

    } catch (error) {
      setError(error.message);
    } finally {
      setAutoLoading(false);
    }
  };

  // 処理開始
  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    // 手動処理状況のみ表示、自動処理状況は消す
    setProcessingStatus(null);
    setAutoProcessingStatus(null);

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
      setAutoProcessId(data.process_id);
      setProcessingStatus({ status: 'processing', message: '手動処理を開始しました', progress: 0 });
      setAutoProcessingStatus(null); // 自動状況は消す

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 処理状況の確認
  useEffect(() => {
    if (!processId) return;

    // 手動処理状況を必ず表示
    setProcessingStatus((prev) => prev || { status: 'processing', message: '手動処理を開始しました', progress: 0 });

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/posdata/status/${processId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const status = await response.json();
          setProcessingStatus(status);

          if (status.status === 'completed') {
            setProcessId(null);
            if (onProcessComplete) onProcessComplete();
          } else if (status.status === 'failed') {
            setProcessId(null);
          }
        } else {
          // APIエラー時もStatusBoxでエラー表示
          const errorData = await response.json().catch(() => ({}));
          setProcessingStatus({ status: 'failed', message: errorData.error || `APIエラー: ${response.status}` });
        }
      } catch (error) {
        setProcessingStatus({ status: 'failed', message: `通信エラー: ${error.message}` });
        console.error('Status check error:', error);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [processId, onProcessComplete]);

  // 自動処理状況の確認
  useEffect(() => {
    if (!autoProcessId) return;

    const checkAutoStatus = async () => {
      try {
        const response = await fetch(`/api/posdata/auto-status/${autoProcessId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const status = await response.json();
          setAutoProcessingStatus(status);

          if (status.status === 'completed') {
            setAutoProcessId(null);
            if (onAutoProcessComplete) onAutoProcessComplete(autoProcessId);
          } else if (status.status === 'failed') {
            setAutoProcessId(null);
          }
        }
      } catch (error) {
        console.error('Auto status check error:', error);
      }
    };

    const interval = setInterval(checkAutoStatus, 2000);
    return () => clearInterval(interval);
  }, [autoProcessId, onAutoProcessComplete]);

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

  // 自動処理結果のダウンロード
  const handleAutoDownload = async (dataType) => {
    try {
      const response = await fetch(`/api/posdata/auto-download/${autoProcessId}/${dataType}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}_result.csv`;
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

      {/* 年齢マッピング・範囲指定セクション（アップロード直下に移動） */}
      {columns.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1rem", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #bdbdbd" }}>
          <h4 style={{ color: "#6c757d", marginBottom: "1rem" }}>🎂 年齢マッピング・抽出範囲</h4>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              年齢列:
            </label>
            <select
              value={ageColumn}
              onChange={e => setAgeColumn(e.target.value)}
              style={{ width: "300px" }}
            >
              <option value="">選択してください（任意）</option>
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <label>
              最小年齢:
              <input
                type="number"
                min="0"
                max={maxAge}
                value={minAge}
                onChange={e => setMinAge(Number(e.target.value))}
                style={{ marginLeft: "10px", width: "80px" }}
                disabled={!ageColumn}
              />
            </label>
            <label>
              最大年齢:
              <input
                type="number"
                min={minAge}
                max="120"
                value={maxAge}
                onChange={e => setMaxAge(Number(e.target.value))}
                style={{ marginLeft: "10px", width: "80px" }}
                disabled={!ageColumn}
              />
            </label>
          </div>
          <p style={{ color: "#888", marginTop: "0.5rem" }}>年齢列・範囲を指定すると、その範囲のデータのみ抽出して処理します（任意）</p>
        </div>
      )}

      {/* 自動処理ボタン */}
      {columns.length > 0 && (
        <div style={{ marginBottom: "20px", padding: "1.5rem", background: "linear-gradient(135deg, #e8f5e8, #d4edda)", borderRadius: "16px", border: "2px solid #28a745" }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#28a745", fontWeight: "600" }}>🚀 自動処理（推奨）</h3>
          <p style={{ marginBottom: "1rem", color: "#155724" }}>
            アップロードしたPOSデータから「カード番号」「利用日時」「利用金額」「テナント名」に対応する列をLLMが類推して クラスタリング → ネットワーク描画 → レーダーチャートを自動実行するための前処理を行います。
          </p>
          <button
            onClick={handleAutoProcess}
            disabled={autoLoading}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: autoLoading ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "600",
              boxShadow: "0 4px 15px rgba(40, 167, 69, 0.3)"
            }}
          >
            {autoLoading ? "⏳ 自動処理中..." : "🚀 自動処理開始"}
          </button>
        </div>
      )}

      {/* 自動・手動処理状況表示（同時に出ないように分岐） */}
      {autoProcessingStatus ? (
        <StatusBox
          status={autoProcessingStatus}
          onDownload={handleDownload}
          onDownloadClustering={handleAutoDownload}
          isAuto={true}
          handleAutoDownload={handleAutoDownload}
        />
      ) : processingStatus ? (
        <StatusBox
          status={processingStatus}
          onDownload={handleDownload}
          onDownloadClustering={handleDownload}
          isAuto={false}
          handleAutoDownload={handleDownload}
        />
      ) : null}

      {/* 手動処理セクション */}
      <div style={{ marginTop: "2rem", padding: "1.5rem", background: "rgba(248, 249, 250, 0.8)", borderRadius: "16px", border: "1px solid #6c757d" }}>
        <h3 style={{ margin: "0 0 1rem 0", color: "#6c757d", fontWeight: "600" }}>⚙️ 手動処理（詳細設定）</h3>

        {/* 列名マッピング */}
        {columns.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ color: "#6c757d", marginBottom: "1rem" }}>🔗 列名マッピング</h4>
            <p className="instruction-text">POSデータの列名を適切な意味にマッピングしてください</p>
            {Object.entries(requiredColumns).map(([requiredCol, description]) => (
              requiredCol === "年齢" ? null : (
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
                    {columns
                      // すでに他の日本語名に割り当てられているカラムは除外
                      .filter(col => {
                        const alreadyMapped = Object.entries(columnMapping).find(
                          ([key, val]) => key === col && val !== requiredCol
                        );
                        return !alreadyMapped;
                      })
                      .map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                  </select>
                </div>
              )
            ))}
          </div>
        )}

        {/* パラメータ設定 */}
        {columns.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ color: "#6c757d", marginBottom: "1rem" }}>⚙️ 処理パラメータ</h4>
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

        {/* 手動処理開始ボタン */}
        {columns.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={handleProcess}
              disabled={loading || Object.keys(columnMapping).length < 4}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "処理中..." : "手動前処理開始"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
});
