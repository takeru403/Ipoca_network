# backend/mindmap/routes.py

from flask import Blueprint, jsonify
from .create_mindmap import main as generate_mindmap

mindmap_bp = Blueprint("mindmap", __name__)

@mindmap_bp.route("/api/mindmap", methods=["GET"])
def mindmap_api():
    mindmap = generate_mindmap()
    return jsonify(mindmap)
