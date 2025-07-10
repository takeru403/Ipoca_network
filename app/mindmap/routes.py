# backend/mindmap/routes.py

from flask import Blueprint, jsonify, request
from .create_mindmap import main as generate_mindmap, load_mindmap_cache, save_mindmap_cache, generate_mindmap_from_idea

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

@mindmap_bp.route("/api/mindmap/generate-from-idea", methods=["POST"])
def mindmap_generate_from_idea_api():
    data = request.get_json()
    ai_idea = data.get("ai_idea", "")
    title = data.get("title", "販促アイディア")

    mindmap = generate_mindmap_from_idea(ai_idea, title)
    return jsonify({"status": "ok", "mindmap": mindmap})
