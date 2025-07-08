# service.py
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import math
from io import BytesIO
from flask import jsonify, send_file, request, Blueprint
import japanize_matplotlib
import tempfile
import os
import logging
import traceback

# ログ設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

upload_bp = Blueprint("upload", __name__)

metrics = [
    "ユニーク客数",
    "売上",
    "平均頻度(日数/ユニーク客数)",
    "1日あたり購買金額",
    "日別合計媒介中心"
]

df_cache = {}  # 簡易メモリキャッシュ

def upload_metrics_file():
    try:
        f = request.files.get("file")
        if not f or not f.filename or not f.filename.endswith((".csv", ".xlsx")):
            return jsonify({"error": "無効なファイルです"}), 400

        # ファイルの内容を完全にコピーしてから処理
        file_content = f.read()
        if file_content is None:
            raise ValueError('ファイル内容が空です')

        # 完全に独立したバイト列として保存
        if isinstance(file_content, bytes):
            file_bytes_for_thread = file_content
        elif isinstance(file_content, str):
            file_bytes_for_thread = file_content.encode('utf-8')
        else:
            file_bytes_for_thread = str(file_content).encode('utf-8')

        # 完全に独立したコピーを作成
        file_bytes_for_thread = bytes(file_bytes_for_thread)
        filename = f.filename

        # ファイルオブジェクトとfile_contentを明示的にNoneにして参照を断つ
        f = None
        file_content = None

        logger.info(f"ファイル内容読み込み完了: {len(file_bytes_for_thread)} バイト")

        # ファイルを一時的に保存してから読み込み
        temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file.write(file_bytes_for_thread)
        temp_file.flush()
        temp_file.close()
        temp_file_path = temp_file.name

        try:
            if filename and isinstance(filename, str) and filename.endswith(".csv"):
                df = pd.read_csv(temp_file_path, encoding="utf-8-sig")
            else:
                df = pd.read_excel(temp_file_path)
            if "テナント名" not in df.columns:
                return jsonify({"error": "テナント名列が存在しません"}), 400

            df_cache["metrics_df"] = df
            tenant_list = df["テナント名"].unique().tolist()
            return jsonify({"tenants": tenant_list})
        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_normalized_data():
    try:
        df = df_cache.get("metrics_df")
        if df is None:
            return jsonify({"error": "データが未アップロードです"}), 400

        request_data = request.get_json()
        if request_data is None:
            return jsonify({"error": "リクエストデータが無効です"}), 400

        selected = request_data.get("tenants", [])
        if not selected or len(selected) > 5:
            return jsonify({"error": "最大5件までのテナントを選択してください"}), 400

        df_selected = df[df["テナント名"].isin(selected)].copy()
        if df_selected.empty:
            return jsonify({"error": "該当するテナントが見つかりません" }), 400

        out = []
        for m in metrics:
            row = {"metric": m}
            for t in selected:
                v = df_selected[df_selected["テナント名"] == t][m].values
                row[t] = str(round(float(v[0]), 3)) if len(v) else "0"
            out.append(row)

        return jsonify({"data": out, "tenants": selected})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
