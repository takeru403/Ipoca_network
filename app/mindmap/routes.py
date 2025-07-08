# backend/mindmap/routes.py

from flask import Blueprint, jsonify
from .create_mindmap import main as generate_mindmap, load_mindmap_cache, save_mindmap_cache

mindmap_bp = Blueprint("mindmap", __name__)

@mindmap_bp.route("/api/mindmap", methods=["GET"])
def mindmap_api():
    mindmap = load_mindmap_cache()
    return jsonify(mindmap)

@mindmap_bp.route("/api/mindmap/generate", methods=["POST"])
def mindmap_generate_api():
    mindmap = generate_mindmap()
    save_mindmap_cache(mindmap)
    return jsonify({"status": "ok", "mindmap": mindmap})
