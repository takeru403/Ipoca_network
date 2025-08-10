from flask import Blueprint, request, jsonify
#from .generate_note import generate_note  # 必要なら有効化
from app.factpanel.fact_narration import generate_narration_with_llm
from app.upload.service import df_cache
from app.posdata.routes import auto_processing_data
from app.network.draw_network import create_network_json
import openai
import os
import pandas as pd
import tempfile
import logging
from dotenv import load_dotenv,find_dotenv
import logfire
load_dotenv(find_dotenv("../.env"))

logger = logging.getLogger(__name__)

note_bp = Blueprint("obsidian", __name__, url_prefix="/obsidian")

LOGFIRE_TOKEN = os.getenv("LOGFIRE_TOKEN")
if LOGFIRE_TOKEN:
    logfire.configure(token=LOGFIRE_TOKEN)
else:
    logger.warning("LOGFIRE_TOKENが設定されていません。s")
# /generateエンドポイントは一旦省略

@note_bp.route("/generate-idea", methods=["POST"])
def generate_idea():
    data = request.get_json()
    category = data.get("category")
    metric = data.get("metric")
    if not category or not metric:
        return jsonify({"error": "カテゴリ名と指標名は必須です"}), 400

    # デバッグ用ログ
    logger.info(f"auto_processing_data keys: {list(auto_processing_data.keys())}")
    logger.info(f"auto_processing_data content: {auto_processing_data}")

    # 1. POSデータの取得（auto_processing_dataから最新のデータを取得）
    if not auto_processing_data:
        return jsonify({"error": "POSデータが未処理です。まずPOSデータ前処理を実行してください。"}), 400

    # 最新の処理IDを取得
    try:
        latest_process_id = max(auto_processing_data.keys())
        logger.info(f"Latest process ID: {latest_process_id}")
    except ValueError as e:
        logger.error(f"Error getting latest process ID: {e}")
        return jsonify({"error": "処理IDの取得に失敗しました"}), 500

    pos_data_info = auto_processing_data[latest_process_id].get('pos_data', {})
    logger.info(f"POS data info: {pos_data_info}")

    if not pos_data_info:
        return jsonify({"error": "POSデータが見つかりません"}), 400

    # カテゴリ情報の取得
    categories = auto_processing_data[latest_process_id].get('category', [])
    category_text = f"{categories}" if categories else "（カテゴリ情報なし）"

    # 一時ファイルからPOSデータを読み込み
    try:
        pos_filename = pos_data_info.get('filename')
        if not pos_filename:
            return jsonify({"error": "POSデータファイル名が見つかりません"}), 400

        pos_file_path = os.path.join(tempfile.gettempdir(), pos_filename)
        logger.info(f"POS file path: {pos_file_path}")

        if not os.path.exists(pos_file_path):
            return jsonify({"error": f"POSデータファイルが見つかりません: {pos_file_path}"}), 400

        df = pd.read_csv(pos_file_path)
        logger.info(f"POS data loaded: {len(df)} rows, {len(df.columns)} columns")

        # fact_narration.pyのナレーション取得
        narration = generate_narration_with_llm(df)
    except Exception as e:
        logger.error(f"POS data loading error: {str(e)}")
        return jsonify({"error": f"POSデータ読み込みエラー: {str(e)}"}), 500

    # 2. レーダーチャートデータ取得（ダミーデータ）
    radar_text = f"{category}カテゴリの{metric}について、POSデータ分析結果に基づいて販促企画を検討します。"

    # metricが「日別合計媒介中心」の場合はネットワーク特徴量も取得
    network_analysis = ""
    if metric == "日別合計媒介中心":
        network_data = auto_processing_data[latest_process_id].get('network_data', {})
        if network_data and 'nodes' in network_data and 'links' in network_data:
            nodes = network_data['nodes']
            links = network_data['links']
            network_analysis = f"""
【ネットワーク分析結果】
- ノード数: {len(nodes)}個
- リンク数: {len(links)}個
- 平均次数: {len(links) * 2 / len(nodes) if nodes else 0:.2f}

【主要な店舗（中心性上位）】
"""
            if nodes:
                sorted_nodes = sorted(nodes, key=lambda x: x.get('betweenness', 0), reverse=True)
                for i, node in enumerate(sorted_nodes[:5]):
                    network_analysis += f"- {node['id']}: 媒介中心性={node.get('betweenness', 0):.3f}, 次数中心性={node.get('degree', 0):.3f}\n"
        else:
            network_analysis = "【ネットワーク分析結果】\nネットワークデータが見つかりません。"

    # 3. プロンプト生成
    prompt = f"""
【カテゴリ情報】
{category_text}

【POSデータ要約ナレーション】
{narration}

【レーダーチャートデータ】
{radar_text}

"""
    if network_analysis:
        prompt += f"{network_analysis}\n"
    prompt += f"""
【お題】
「{category}」カテゴリの「{metric}」指標を改善するための販促企画を考えてください。
"""

    # 4. LLM呼び出し
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        return jsonify({"error": "OpenAI APIキーが設定されていません"}), 500
    try:
        logfire.instrument_openai()
        client = openai.OpenAI(api_key=openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2000
        )
        idea = response.choices[0].message.content if response.choices else ""
    except Exception as e:
        return jsonify({"error": f"LLM呼び出しエラー: {str(e)}"}), 500

    return jsonify({"idea": idea})

@note_bp.route("/generate-network-idea", methods=["POST"])
def generate_network_idea():
    data = request.get_json()
    categoryA = data.get("categoryA")
    categoryB = data.get("categoryB")
    if not categoryA or not categoryB:
        return jsonify({"error": "カテゴリ名Aとカテゴリ名Bは必須です"}), 400

    # デバッグ用ログ
    logger.info(f"auto_processing_data keys: {list(auto_processing_data.keys())}")

    # 1. POSデータの取得（auto_processing_dataから最新のデータを取得）
    if not auto_processing_data:
        return jsonify({"error": "POSデータが未処理です。まずPOSデータ前処理を実行してください。"}), 400

    # 最新の処理IDを取得
    try:
        latest_process_id = max(auto_processing_data.keys())
        logger.info(f"Latest process ID: {latest_process_id}")
    except ValueError as e:
        logger.error(f"Error getting latest process ID: {e}")
        return jsonify({"error": "処理IDの取得に失敗しました"}), 500

    pos_data_info = auto_processing_data[latest_process_id].get('pos_data', {})
    network_data = auto_processing_data[latest_process_id].get('network_data', {})

    if not pos_data_info:
        return jsonify({"error": "POSデータが見つかりません"}), 400

    # 一時ファイルからPOSデータを読み込み
    try:
        pos_filename = pos_data_info.get('filename')
        if not pos_filename:
            return jsonify({"error": "POSデータファイル名が見つかりません"}), 400

        pos_file_path = os.path.join(tempfile.gettempdir(), pos_filename)
        logger.info(f"POS file path: {pos_file_path}")

        if not os.path.exists(pos_file_path):
            return jsonify({"error": f"POSデータファイルが見つかりません: {pos_file_path}"}), 400

        df = pd.read_csv(pos_file_path)
        logger.info(f"POS data loaded: {len(df)} rows, {len(df.columns)} columns")

        # fact_narration.pyのナレーション取得
        narration = generate_narration_with_llm(df)
    except Exception as e:
        logger.error(f"POS data loading error: {str(e)}")
        return jsonify({"error": f"POSデータ読み込みエラー: {str(e)}"}), 500

    # 2. ネットワーク特徴量の分析
    network_analysis = ""
    if network_data and 'nodes' in network_data and 'links' in network_data:
        nodes = network_data['nodes']
        links = network_data['links']

        # ネットワークの基本統計
        network_analysis = f"""
【ネットワーク分析結果】
- ノード数: {len(nodes)}個
- リンク数: {len(links)}個
- 平均次数: {len(links) * 2 / len(nodes) if nodes else 0:.2f}

【主要な店舗（中心性上位）】
"""
        # 中心性でソートして上位5件を表示
        if nodes:
            sorted_nodes = sorted(nodes, key=lambda x: x.get('betweenness', 0), reverse=True)
            for i, node in enumerate(sorted_nodes[:5]):
                network_analysis += f"- {node['id']}: 媒介中心性={node.get('betweenness', 0):.3f}, 次数中心性={node.get('degree', 0):.3f}\n"
    else:
        network_analysis = "【ネットワーク分析結果】\nネットワークデータが見つかりません。"

    # 3. プロンプト生成
    prompt = f"""
【POSデータ要約ナレーション】
{narration}

{network_analysis}

【お題】
「{categoryA}」カテゴリと「{categoryB}」カテゴリを回遊させるための販促企画を考えてください。
ネットワーク分析の結果も参考にして、効果的な回遊促進策を提案してください。
"""

    # 4. LLM呼び出し
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        return jsonify({"error": "OpenAI APIキーが設定されていません"}), 500
    try:
        client = openai.OpenAI(api_key=openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800
        )
        idea = response.choices[0].message.content if response.choices else ""
    except Exception as e:
        return jsonify({"error": f"LLM呼び出しエラー: {str(e)}"}), 500

    return jsonify({"idea": idea})
