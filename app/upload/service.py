# service.py
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import math
from io import BytesIO
from flask import jsonify, send_file, request
import japanize_matplotlib

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
        if not f or not f.filename.endswith((".csv", ".xlsx")):
            return jsonify({"error": "無効なファイルです"}), 400

        df = pd.read_csv(f, encoding="utf-8-sig") if f.filename.endswith(".csv") else pd.read_excel(f)
        if "テナント名" not in df.columns:
            return jsonify({"error": "テナント名列が存在しません"}), 400

        df_cache["metrics_df"] = df
        tenant_list = df["テナント名"].unique().tolist()
        return jsonify({"tenants": tenant_list})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_normalized_data():
    try:
        df = df_cache.get("metrics_df")
        if df is None:
            return jsonify({"error": "データが未アップロードです"}), 400

        selected = request.json.get("tenants", [])
        if not selected or len(selected) > 5:
            return jsonify({"error": "最大5件までのテナントを選択してください"}), 400

        df_selected = df[df["テナント名"].isin(selected)].copy()
        if df_selected.empty:
            return jsonify({"error": "該当するテナントが見つかりません"}), 400

        out = []
        for m in metrics:
            row = {"metric": m}
            for t in selected:
                v = df_selected[df_selected["テナント名"] == t][m].values
                row[t] = round(float(v[0]), 3) if len(v) else 0
            out.append(row)

        return jsonify({"data": out, "tenants": selected})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
