from flask import Blueprint, request, jsonify, send_file
from app.decorators import login_required
from .service import generate_radar_chart, generate_json_data

upload_bp = Blueprint("upload", __name__, url_prefix="/api")

@upload_bp.post("/upload")
@login_required
def upload_png():
    return generate_radar_chart(request)

@upload_bp.post("/upload-json")
@login_required
def upload_json():
    return generate_json_data(request)
