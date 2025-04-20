"""
Flask + React back‑end
────────────────────────────────────────
• /api/login     POST  {username,password}   → セッション開始
• /api/logout    POST                       → セッション終了
• /api/search              (Google Slides 類似検索)
• /api/upload              (画像返却)
• /api/upload-json         (recharts 用 JSON)
────────────────────────────────────────
"""

from __future__ import annotations
import os, math, json
from functools import wraps
from io import BytesIO
from typing import Callable

from flask import (
    Flask, request, jsonify, send_from_directory, render_template,
    session, send_file
)
from flask_cors import CORS

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# ──────────────────────────────────────────────────────────
# .env 読み込み
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv("../.env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SECRET_KEY     = os.getenv("FLASK_SECRET_KEY", "PLEASE_CHANGE_ME")

# ──────────────────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder=os.path.abspath("../frontend/build/static"),
    template_folder=os.path.abspath("../frontend/build")
)
app.secret_key = SECRET_KEY

# 本番クッキー設定
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=not app.debug
)

# CORS（必要な場合のみ有効。フロントと同一オリジンならコメントアウト）
CORS(app, supports_credentials=True)

# ───── 認証ユーティリティ ────────────────────────────
def login_required(func: Callable):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if session.get("user") != "ipoca_test":
            return jsonify({"error": "login_required"}), 401
        return func(*args, **kwargs)
    return wrapper

# ───── 認証 API ─────────────────────────────────────
@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    if data.get("username") == "ipoca_test" and data.get("password") == "ipoca_test":
        session.permanent = True
        session["user"] = "ipoca_test"
        return jsonify({"message": "logged_in"})
    return jsonify({"error": "invalid_credentials"}), 401

@app.post("/api/logout")
@login_required
def logout():
    session.clear()
    return jsonify({"message": "logged_out"})

# ───── React ルーティング ───────────────────────────
@app.get("/")
def index():
    return render_template("index.html")

@app.get("/<path:path>")
def static_proxy(path: str):
    file_path = os.path.join(app.template_folder, path)
    if os.path.exists(file_path):
        # 画像や CSS/JS を個別配信
        return send_from_directory(app.template_folder, path)
    # React‑Router のために index.html
    return render_template("index.html")

# ───── Google Slides 類似検索 API ─────────────────────
from googleapiclient.discovery import build          # type: ignore
from google.oauth2.credentials import Credentials    # type: ignore
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

from langchain_community.vectorstores import Chroma     # type: ignore
from langchain.schema import Document                   # type: ignore
from langchain_openai import OpenAIEmbeddings            # type: ignore

from chromadb.config import Settings
import tempfile, os
import chromadb

TMP_DIR = os.path.join(tempfile.gettempdir(), "chroma_slides")
os.makedirs(TMP_DIR, exist_ok=True)

SCOPES = ["https://www.googleapis.com/auth/presentations.readonly"]
PRESENTATION_ID = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds"

@app.post("/api/search")
@login_required
def search():
    query = (request.get_json() or {}).get("query", "").strip()
    if not query:
        return jsonify({"error": "query_required"}), 400

    # 認証トークン
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as f:
            f.write(creds.to_json())

    service = build("slides", "v1", credentials=creds)
    presentation = service.presentations().get(
        presentationId=PRESENTATION_ID
    ).execute()

    # テキスト抽出
    slide_texts: list[str] = []
    for slide in presentation.get("slides", []):
        parts = []
        for elem in slide.get("pageElements", []):
            txt = (
                elem.get("shape", {})
                    .get("text", {})
                    .get("textElements", [])
            )
            for t in txt:
                run = t.get("textRun")
                if run:
                    parts.append(run.get("content", ""))
        slide_texts.append("".join(parts))

    # ベクトル検索
    docs = [
        Document(page_content=slide_texts[i], metadata={"idx": i})
        for i in range(len(slide_texts))
    ]
    client = chromadb.PersistentClient(path=TMP_DIR)   # 永続したい場合

    store = Chroma.from_documents(
        docs,
        OpenAIEmbeddings(api_key=OPENAI_API_KEY),
        collection_name="slides",
        client=client,
        client_settings=Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=TMP_DIR,
        ),
    )
    results = store.similarity_search_with_score(query, k=3)

    return jsonify([
        {
            "slide_index": doc.metadata["idx"] + 1,
            "content": doc.page_content,
            "score": score
        }
        for doc, score in results
    ])

# ───── データ可視化 API（画像）────────────────────────
@app.post("/api/upload")
@login_required
def upload_png():
    if "file" not in request.files:
        return jsonify({"error": "file_required"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "filename_required"}), 400
    try:
        df = (
            pd.read_csv(f)
            if f.filename.endswith(".csv")
            else pd.read_excel(f, sheet_name="船橋衣料品")
        )
        metrics = [
            "ユニーク客数", "売上", "平均頻度(日数/ユニーク客数)",
            "1日あたり購買金額", "日別合計媒介中心"
        ]
        tenants = [
            "ﾕﾆｸﾛ", "ｱｶﾁｬﾝﾎﾝﾎﾟ", "ZARA",
            "ABC-MART GRAND STAGE", "THE NORTH FACE +", "DIESEL"
        ]

        df_norm = df.copy()
        for m in metrics:
            df_norm[m] = np.log1p(df_norm[m])
            df_norm[m] = (
                df_norm[m] - df_norm[m].min()
            ) / (df_norm[m].max() - df_norm[m].min())

        plot_df = df_norm[df_norm["テナント名"].isin(tenants)]

        # ---- Radar plot ----
        plt.figure(figsize=(6, 6))
        ax = plt.subplot(111, polar=True)
        angles = [n / float(len(metrics)) * 2 * math.pi for n in range(len(metrics))]
        angles += angles[:1]

        for tenant in tenants:
            row = plot_df[plot_df["テナント名"] == tenant].iloc[0]
            values = row[metrics].tolist() + [row[metrics[0]]]
            ax.plot(angles, values, linewidth=1, linestyle="solid", label=tenant)
            ax.fill(angles, values, alpha=0.1)

        ax.set_theta_offset(math.pi / 2)
        ax.set_theta_direction(-1)
        plt.xticks(angles[:-1], metrics, fontsize=9)
        ax.set_rlabel_position(0)
        plt.yticks([0.25, 0.5, 0.75, 1.0], fontsize=7)
        ax.set_ylim(0, 1)
        plt.title("Log‑norm Radar Chart", y=1.1)
        plt.legend(loc="upper right", bbox_to_anchor=(1.2, 1.1))

        buf = BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)
        plt.close()
        return send_file(buf, mimetype="image/png")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ───── データ可視化 API（JSON for Recharts）────────────
@app.post("/api/upload-json")
@login_required
def upload_json():
    if "file" not in request.files:
        return jsonify({"error": "file_required"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "filename_required"}), 400
    try:
        df = (
            pd.read_csv(f)
            if f.filename.endswith(".csv")
            else pd.read_excel(f, sheet_name="船橋衣料品")
        )
        metrics = [
            "ユニーク客数", "売上", "平均頻度(日数/ユニーク客数)",
            "1日あたり購買金額", "日別合計媒介中心"
        ]
        tenants = [
            "ﾕﾆｸﾛ", "ｱｶﾁｬﾝﾎﾝﾎﾟ", "ZARA",
            "ABC-MART GRAND STAGE", "THE NORTH FACE +", "DIESEL"
        ]

        df_norm = df.copy()
        for m in metrics:
            df_norm[m] = np.log1p(df_norm[m])
            df_norm[m] = (
                df_norm[m] - df_norm[m].min()
            ) / (df_norm[m].max() - df_norm[m].min())
        plot_df = df_norm[df_norm["テナント名"].isin(tenants)]

        out = []
        for m in metrics:
            row = {"metric": m}
            for t in tenants:
                v = plot_df[plot_df["テナント名"] == t][m].values
                row[t] = round(float(v[0]), 3) if len(v) else 0
            out.append(row)

        return jsonify({"data": out, "tenants": tenants})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
