// src/api.js

/**
 * 共通の fetch ラッパー（JSON 応答を前提）
 */
export async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include", // Cookie を送信する
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const contentType = res.headers.get("content-type");
  const body = contentType?.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text();

  if (!res.ok) {
    const msg = body?.error || body || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return body;
}

/**
 * ファイルアップロード専用のラッパー
 */
export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload-json", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return json;
}
