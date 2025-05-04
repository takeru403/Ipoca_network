# routes.py
from flask import Blueprint, request, jsonify
from .service import upload_metrics_file, get_normalized_data

upload_bp = Blueprint("upload", __name__, url_prefix="/api")

# POST /api/upload-file : CSVまたはExcelを受け取ってテナント名一覧を返す
@upload_bp.route("/upload-file", methods=["POST"])
def route_upload_file():
    return upload_metrics_file()

# POST /api/fetch-radar : 選択されたテナント名を受け取ってRadarChart用データを返す
@upload_bp.route("/fetch-radar", methods=["POST"])
def route_fetch_radar():
    return get_normalized_data()
