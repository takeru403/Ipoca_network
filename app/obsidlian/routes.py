from flask import Blueprint
from .generate_note import generate_note

bp = Blueprint("obsidian", __name__, url_prefix="/obsidian")

@bp.route("/generate", methods=["POST"])
def create_note():
    generate_note()
    return {"message": "ノートを生成しました"}
