from flask import Blueprint, request, jsonify, send_file
from app.decorators import login_required
from .draw_network import create_network_plot
import io

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
        fig = create_network_plot(f)

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)

        return send_file(buf, mimetype="image/png")

    except Exception as e:
        return jsonify({"error": str(e)}), 500
