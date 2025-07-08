from flask import Blueprint, request, jsonify
from app.decorators import login_required
from .draw_network import create_network_json
import traceback
import logging
import tempfile
import os
import pandas as pd

network_bp = Blueprint("network", __name__)

@network_bp.route("/api/network", methods=["POST"])
@login_required
def network():
    try:
        if "file" not in request.files:
            return jsonify({"error": "file_required"}), 400

        f = request.files["file"]
        if not f.filename:
            return jsonify({"error": "filename_required"}), 400

        # ファイル拡張子のチェック
        if not f.filename.endswith(('.csv', '.xlsx')):
            return jsonify({
                "error": "invalid_file_type",
                "message": "CSVまたはExcelファイルのみ対応しています"
            }), 400

        # ファイルの内容を完全に読み込んでコピー
        file_content = f.read()
        f.seek(0)  # ファイルポインタをリセット

        # ファイルを一時的に保存してから読み込み
        temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file.write(file_content)
        temp_file.flush()  # バッファをフラッシュ
        temp_file.close()  # ファイルを閉じる
        temp_file_path = temp_file.name

        try:
            # ファイル読み込み
            if f.filename and f.filename.endswith(".csv"):
                df = pd.read_csv(temp_file_path)
            else:
                df = pd.read_excel(temp_file_path)

            data = create_network_json(temp_file_path)
            return jsonify(data)
        except Exception as e:
            logging.error(f"Network creation error: {str(e)}")
            logging.error(traceback.format_exc())
            return jsonify({
                "error": "network_creation_failed",
                "message": str(e),
                "details": traceback.format_exc()
            }), 500
        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({
            "error": "unexpected_error",
            "message": str(e),
            "details": traceback.format_exc()
        }), 500
