# app/voice_narration/routes.py

from flask import Blueprint, request, jsonify, send_file
from app.decorators import login_required
import tempfile
import os
from gtts import gTTS
import openai
from app.config import Config

voice_narration_bp = Blueprint("voice_narration", __name__, url_prefix="/api")

@voice_narration_bp.route("/voice-narration", methods=["POST"])
@login_required
def voice_narration():
    """
    音声ナレーションの生成エンドポイント
    リクエストボディにJSON形式で以下のキーを含める必要があります。
    - "text": 音声ナレーションに使用するテキスト（AIアイディア等）
    """
    data = request.get_json()
    text = data.get("text", "")
    if not text:
        return jsonify({"error": "textは必須です"}), 400

    # 1. OpenAIで要約・ナレーション用テキスト生成
    openai.api_key = Config.OPENAI_API_KEY
    prompt = (
        "以下の販促ソリューションアイディアを、店舗スタッフや経営者が聞いてすぐ理解できるように、\n"
        "やさしい日本語で100文字程度に要約し、ナレーション原稿として出力してください。\n"
        "余計な説明や出力例は不要です。\n"
        f"\n# アイディア本文\n{text}\n"
    )
    try:
        completion = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200,
        )
        narration_text = completion.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"要約生成エラー: {str(e)}"}), 500

    # 2. gTTSで音声ファイル生成
    try:
        tts = gTTS(narration_text, lang='ja')
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
            tts.save(fp.name)
            temp_path = fp.name
    except Exception as e:
        return jsonify({"error": f"TTS生成エラー: {str(e)}"}), 500

    # 3. 音声ファイルを返却
    try:
        return send_file(temp_path, mimetype='audio/mpeg', as_attachment=False, download_name='narration.mp3')
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


