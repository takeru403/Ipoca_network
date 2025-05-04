from flask import Blueprint, request, jsonify
from app.decorators import login_required
from .service import perform_search

search_bp = Blueprint("search", __name__, url_prefix="/api")

@search_bp.post("/search")
@login_required
def search():
    query = request.get_json().get("query", "").strip()
    if not query:
        return jsonify({"error": "query_required"}), 400
    return jsonify(perform_search(query))
