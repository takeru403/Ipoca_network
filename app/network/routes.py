from flask import Blueprint, request, jsonify
from app.decorators import login_required
from .draw_network import create_network_json

network_bp = Blueprint("network", __name__)

@network_bp.route("/api/network", methods=["POST"])
@login_required
def network():
    if "file" not in request.files:
        return jsonify({"error": "file_required"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "filename_required"}), 400

    try:
        data = create_network_json(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
