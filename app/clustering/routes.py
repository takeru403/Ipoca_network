from flask import Blueprint, request, jsonify, session
import pandas as pd
from .make_clustring import cluster_main
import logging
import io

clustering_bp = Blueprint("clustering", __name__)

# データプレビューAPI
@clustering_bp.route("/api/cluster/preview", methods=["POST"])
def cluster_preview():
    try:
        if "file" not in request.files:
            return jsonify({"error": "ファイルが必要です"}), 400
        file = request.files["file"]
        if file.filename and file.filename.endswith(".csv"):
            df = pd.read_csv(file.stream)
        else:
            df = pd.read_excel(file.stream)
        # 先頭20行とカラム一覧
        preview = df.head(20).to_dict(orient="records")
        columns = list(df.columns)
        return jsonify({
            "preview": preview,
            "columns": columns
        })
    except Exception as e:
        logging.error(f"クラスタプレビューAPIエラー: {str(e)}")
        return jsonify({"error": str(e)}), 500

@clustering_bp.route("/api/cluster", methods=["POST"])
def cluster_api():
    try:
        if "file" not in request.files:
            return jsonify({"error": "ファイルが必要です"}), 400
        file = request.files["file"]
        if file.filename and file.filename.endswith(".csv"):
            df = pd.read_csv(file.stream)
        else:
            df = pd.read_excel(file.stream)
        n_clusters = int(request.form.get("n_clusters", 4))
        selected_columns = request.form.get("selected_columns")
        if selected_columns:
            import json
            selected_columns = json.loads(selected_columns)
            df = df[selected_columns]
        # クラスタリング実行
        result = cluster_main(df, n_clusters=n_clusters)
        # agg_dfをlist of dictで返す
        agg_df = result["agg_df"]
        if hasattr(agg_df, 'to_dict'):
            agg_df = agg_df.to_dict(orient="records")
        return jsonify({
            "cluster_names": result["cluster_names"],
            "radar_chart_data": result["radar_chart_data"],
            "agg_df": agg_df
        })
    except Exception as e:
        logging.error(f"クラスタリングAPIエラー: {str(e)}")
        return jsonify({"error": str(e)}), 500

# クラスタ抽出API
@clustering_bp.route("/api/cluster/select", methods=["POST"])
def cluster_select():
    try:
        # クラスタ名を受け取る
        data = request.get_json()
        cluster_name = data.get("cluster_name")
        # セッションやグローバルでagg_dfを保持していない場合、都度ファイルアップロードが必要
        # ここでは一時的にグローバル変数でagg_dfを保持する例（本番はセッションやDB推奨）
        global last_agg_df
        if last_agg_df is None:
            return jsonify({"error": "クラスタリングデータがありません。再度クラスタリングを実行してください。"}), 400
        filtered = [row for row in last_agg_df if row.get("クラスタ名") == cluster_name]
        return jsonify({"data": filtered})
    except Exception as e:
        logging.error(f"クラスタ抽出APIエラー: {str(e)}")
        return jsonify({"error": str(e)}), 500
