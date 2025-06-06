# app/voice_narration/routes.py

from flask import Blueprint, request, jsonify
from app.decorators import login_required

voice_narration_bp = Blueprint("voice_narration", __name__, url_prefix="/api")

@search_bp.post("/voice-narration")
@login_required
def voice_narration():
    """
    音声ナレーションの生成エンドポイント
    リクエストボディにJSON形式で以下のキーを含める必要があります。
    - "text": 音声ナレーションに使用するテキスト
    """


