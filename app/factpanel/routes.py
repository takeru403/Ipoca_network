from flask import Blueprint, request, jsonify, send_file
import pandas as pd
import os
from .fact_narration import generate_narration_with_llm, create_narration_audio

factpanel_bp = Blueprint("factpanel", __name__, url_prefix="/api/factpanel")

@factpanel_bp.route("/narration", methods=[POST])
def narration():
    # フロントからCSVファイルを受け取り、ナレーション生成
    if 'file' not in request.files:
        return jsonify({"error": "ファイルがありません"}), 400
    file = request.files['file']
    try:
        df = pd.read_csv(file)
    except Exception as e:
        return jsonify({"error": f"CSV読み込みエラー: {str(e)}"}), 400
    narration_text = generate_narration_with_llm(df)
    audio_path = create_narration_audio(narration_text)
    return jsonify({"narration_text": narration_text, "audio_file": os.path.basename(audio_path)})

@factpanel_bp.route("/audio/<filename>", methods=["GET"])
def get_audio(filename):
    audio_path = os.path.join(os.getcwd(), filename)
    if not os.path.exists(audio_path):
        return jsonify({"error": "ファイルが存在しません"}), 404
    return send_file(audio_path, as_attachment=True)
