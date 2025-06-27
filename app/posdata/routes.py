from flask import Blueprint, request, jsonify, send_file
from app.decorators import login_required
from .pos_preprocessing import calc_asociation, build_node_edge_df, process_pos_data_background
import pandas as pd
import io
import tempfile
import os
import logging
import json
import threading
from datetime import datetime

posdata_bp = Blueprint("posdata", __name__)

# 処理状態を保存するグローバル辞書
processing_status = {}

@posdata_bp.route("/api/posdata/upload", methods=["POST"])
@login_required
def upload_posdata():
    try:
        if "file" not in request.files:
            return jsonify({"error": "file_required"}), 400

        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "filename_required"}), 400

        # ファイル読み込み
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.stream)
        else:
            df = pd.read_excel(file.stream)

        # 列名の取得
        columns = df.columns.tolist()

        return jsonify({
            "message": "ファイルが正常にアップロードされました",
            "columns": columns,
            "row_count": len(df)
        })

    except Exception as e:
        logging.error(f"POS data upload error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@posdata_bp.route("/api/posdata/process", methods=["POST"])
@login_required
def process_posdata():
    try:
        if "file" not in request.files:
            return jsonify({"error": "file_required"}), 400

        file = request.files["file"]
        column_mapping_str = request.form.get("column_mapping", "{}")
        min_support = float(request.form.get("min_support", "0.0001"))
        max_len = int(request.form.get("max_len", "2"))

        # 列名マッピングの解析
        column_mapping = json.loads(column_mapping_str)

        # ファイル読み込み
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.stream)
        else:
            df = pd.read_excel(file.stream)

        # 列名の変更
        df_renamed = df.rename(columns=column_mapping)

        # 必要な列の存在確認
        required_columns = ["カード番号", "利用日時", "利用金額", "ショップ名略称"]
        missing_columns = [col for col in required_columns if col not in df_renamed.columns]
        if missing_columns:
            return jsonify({"error": f"必要な列が不足しています: {missing_columns}"}), 400

        # 処理IDを生成
        process_id = f"pos_process_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # 処理状態を初期化
        processing_status[process_id] = {
            "status": "processing",
            "progress": 0,
            "message": "処理を開始しました"
        }

        # バックグラウンドで処理を実行
        def background_process():
            try:
                processing_status[process_id]["message"] = "アソシエーション分析を実行中..."
                processing_status[process_id]["progress"] = 30

                # 前処理実行
                rules = calc_asociation(df_renamed, min_support=min_support, max_len=max_len)

                processing_status[process_id]["message"] = "ノード・エッジデータを作成中..."
                processing_status[process_id]["progress"] = 70

                # ノード・エッジデータの作成
                node_df, edge_df = build_node_edge_df(rules, "mall_name")

                # 結果をCSVファイルとして保存
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"pos_processed_{timestamp}.csv"
                file_path = os.path.join(tempfile.gettempdir(), filename)

                rules.to_csv(file_path, index=False, encoding='utf-8-sig')

                processing_status[process_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": "処理が完了しました",
                    "filename": filename,
                    "rules_count": len(rules),
                    "nodes_count": len(node_df),
                    "edges_count": len(edge_df)
                })

            except Exception as e:
                logging.error(f"バックグラウンド処理エラー: {str(e)}")
                processing_status[process_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": f"エラーが発生しました: {str(e)}"
                })

        # スレッドでバックグラウンド処理を開始
        thread = threading.Thread(target=background_process)
        thread.daemon = True
        thread.start()

        return jsonify({
            "message": "処理を開始しました",
            "process_id": process_id
        })

    except Exception as e:
        logging.error(f"POS data processing error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@posdata_bp.route("/api/posdata/status/<process_id>", methods=["GET"])
@login_required
def get_processing_status(process_id):
    try:
        if process_id not in processing_status:
            return jsonify({"error": "処理IDが見つかりません"}), 404

        return jsonify(processing_status[process_id])

    except Exception as e:
        logging.error(f"Status check error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@posdata_bp.route("/api/posdata/download/<filename>", methods=["GET"])
@login_required
def download_processed_data(filename):
    try:
        file_path = os.path.join(tempfile.gettempdir(), filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "ファイルが見つかりません"}), 404

        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
    except Exception as e:
        logging.error(f"Download error: {str(e)}")
        return jsonify({"error": str(e)}), 500
