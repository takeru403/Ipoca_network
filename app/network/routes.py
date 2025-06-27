from flask import Blueprint, request, jsonify
from app.decorators import login_required
from .draw_network import create_network_json
import traceback
import logging

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

        try:
            data = create_network_json(f)
            return jsonify(data)
        except Exception as e:
            logging.error(f"Network creation error: {str(e)}")
            logging.error(traceback.format_exc())
            return jsonify({
                "error": "network_creation_failed",
                "message": str(e),
                "details": traceback.format_exc()
            }), 500

    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({
            "error": "unexpected_error",
            "message": str(e),
            "details": traceback.format_exc()
        }), 500
