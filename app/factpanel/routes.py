from flask import Blueprint, request, jsonify, send_file
import pandas as pd
import os
import tempfile
import time
from .fact_narration import generate_narration_with_llm, create_narration_audio

factpanel_bp = Blueprint("factpanel", __name__, url_prefix="/api/factpanel")

@factpanel_bp.route("/narration", methods=["POST"])
def narration():
    # フロントからCSVファイルを受け取り、ナレーション生成
    if 'file' not in request.files:
        return jsonify({"error": "ファイルがありません"}), 400
    file = request.files['file']

    # ファイルの内容を完全に読み込んでコピー
    file_content = file.read()
    file.seek(0)  # ファイルポインタをリセット

    # 一時ファイルに保存してから読み込み
    with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv') as temp_file:
        temp_file.write(file_content)
        temp_file.flush()  # バッファをフラッシュ
        temp_file_path = temp_file.name

    try:
        df = pd.read_csv(temp_file_path)
    except Exception as e:
        return jsonify({"error": f"CSV読み込みエラー: {str(e)}"}), 400
    finally:
        # 一時ファイルを削除
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

    narration_text = generate_narration_with_llm(df)
    # 音声ファイル名にタイムスタンプを付与
    audio_filename = f"fact_narration_{int(time.time())}.mp3"
    audio_path = create_narration_audio(narration_text, filename=audio_filename)
    return jsonify({"narration_text": narration_text, "audio_file": os.path.basename(audio_path)})

@factpanel_bp.route("/audio/<filename>", methods=["GET"])
def get_audio(filename):
    audio_path = os.path.join(os.getcwd(), filename)
    if not os.path.exists(audio_path):
        return jsonify({"error": "ファイルが存在しません"}), 404
    return send_file(audio_path, as_attachment=True)
