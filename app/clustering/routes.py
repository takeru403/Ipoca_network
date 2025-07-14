from flask import Blueprint, request, jsonify, session, send_file
import pandas as pd
from .make_clustring import cluster_main
import logging
import io
import tempfile
import os
from datetime import datetime
import time
import traceback
import copy
import numpy as np
import json

# ログ設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

clustering_bp = Blueprint("clustering", __name__)

# クラスタリング結果を保存するグローバル変数
clustering_results = {}
last_agg_df = None  # グローバル変数を初期化

# --- NaN, inf, pd.NA, None, pd.NaT などを再帰的にNoneへ変換する共通関数 ---
def nan_to_none(obj):
    if obj is None or obj is pd.NA or obj is pd.NaT:
        return None
    if isinstance(obj, (float, np.floating)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, dict):
        # dictのキーがNaNやNoneの場合は文字列'null'に変換
        return {str(nan_to_none(k)) if nan_to_none(k) is None else nan_to_none(k): nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [nan_to_none(v) for v in obj]
    return obj

# DataFrameをdict化する際にカラム名・インデックスも変換
def safe_df_to_dict(df):
    df = df.rename(columns=lambda x: nan_to_none(x))
    if df.index.name is not None:
        df.index = df.index.map(nan_to_none)
    df = df.where(pd.notnull(df), None)
    return df.to_dict(orient="records")

# データプレビューAPI
@clustering_bp.route("/api/cluster/preview", methods=["POST"])
def cluster_preview():
    try:
        if "file" not in request.files:
            return jsonify({"error": "ファイルが必要です"}), 400
        file = request.files["file"]

        # ファイルの内容を完全にコピーしてから処理
        file_content = file.read()
        if file_content is None:
            raise ValueError('ファイル内容が空です')

        # 完全に独立したバイト列として保存
        if isinstance(file_content, bytes):
            file_bytes_for_thread = file_content
        elif isinstance(file_content, str):
            file_bytes_for_thread = file_content.encode('utf-8')
        else:
            file_bytes_for_thread = str(file_content).encode('utf-8')

        # 完全に独立したコピーを作成
        file_bytes_for_thread = bytes(file_bytes_for_thread)
        filename = file.filename

        # ファイルオブジェクトとfile_contentを明示的にNoneにして参照を断つ
        file = None
        file_content = None

        logger.info(f"ファイル内容読み込み完了: {len(file_bytes_for_thread)} バイト")

        # ファイルを一時的に保存してから読み込み
        temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file.write(file_bytes_for_thread)
        temp_file.flush()
        temp_file.close()
        temp_file_path = temp_file.name

        try:
            if filename and isinstance(filename, str) and filename.endswith(".csv"):
                df = pd.read_csv(temp_file_path)
            else:
                df = pd.read_excel(temp_file_path)
            # previewのNaNをNoneに変換（index, columnsも）
            preview_df = df.head(20)
            preview = safe_df_to_dict(preview_df)
            columns = [nan_to_none(col) for col in list(df.columns)]
            return jsonify(nan_to_none({"preview": preview, "columns": columns}))
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except Exception as e:
        logger.error(f"クラスタプレビューAPIエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@clustering_bp.route("/api/cluster", methods=["POST"])
def cluster_api():
    try:
        if "file" not in request.files:
            return jsonify({"error": "ファイルが必要です"}), 400
        file = request.files["file"]

        # ファイルの内容を完全にコピーしてから処理
        file_content = file.read()
        if file_content is None:
            raise ValueError('ファイル内容が空です')

        # 完全に独立したバイト列として保存
        if isinstance(file_content, bytes):
            file_bytes_for_thread = file_content
        elif isinstance(file_content, str):
            file_bytes_for_thread = file_content.encode('utf-8')
        else:
            file_bytes_for_thread = str(file_content).encode('utf-8')

        # 完全に独立したコピーを作成
        file_bytes_for_thread = bytes(file_bytes_for_thread)
        filename = file.filename

        # ファイルオブジェクトとfile_contentを明示的にNoneにして参照を断つ
        file = None
        file_content = None

        logger.info(f"ファイル内容読み込み完了: {len(file_bytes_for_thread)} バイト")

        # ファイルを一時的に保存してから読み込み
        temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file.write(file_bytes_for_thread)
        temp_file.flush()
        temp_file.close()
        temp_file_path = temp_file.name

        try:
            if filename and isinstance(filename, str) and filename.endswith(".csv"):
                df = pd.read_csv(temp_file_path)
            else:
                df = pd.read_excel(temp_file_path)
            n_clusters = int(request.form.get("n_clusters", 4))
            selected_columns = request.form.get("selected_columns")
            if selected_columns:
                import json
                selected_columns = json.loads(selected_columns)
                df = df[selected_columns]
            # クラスタリング実行
            result = cluster_main(df, n_clusters=n_clusters)
            # agg_dfをlist of dictで返す
            agg_df = result["agg_df"]
            if hasattr(agg_df, 'to_dict'):
                agg_df = agg_df.to_dict(orient='records')

            # last_agg_dfにも同じ変換を適用
            global last_agg_df
            last_agg_df = agg_df

            # radar_chart_dataのNaNも変換
            radar_chart_data = nan_to_none(result["radar_chart_data"])

            # 結果を保存（ダウンロード用）
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            result_filename = f"clustering_result_{timestamp}.csv"
            file_path = os.path.join(tempfile.gettempdir(), result_filename)

            # DataFrameに戻して保存
            result_df = pd.DataFrame(agg_df)
            result_df.to_csv(file_path, index=False, encoding='utf-8-sig')

            # 結果をグローバル変数に保存
            clustering_results[result_filename] = {
                'data': result_df,
                'cluster_names': result["cluster_names"],
                'radar_chart_data': radar_chart_data,
                'filename': result_filename
            }

            # 返却直前にNaN混入チェック
            try:
                json.dumps(nan_to_none({
                    "cluster_names": result["cluster_names"],
                    "radar_chart_data": radar_chart_data,
                    "agg_df": agg_df,
                    "download_filename": result_filename
                }), ensure_ascii=False, allow_nan=False)
            except Exception as e:
                print('JSON変換エラー:', e)
                print('cluster_names:', result["cluster_names"])
                print('radar_chart_data:', radar_chart_data)
                print('agg_df:', agg_df)
                print('download_filename:', result_filename)

            return jsonify(nan_to_none({
                "cluster_names": result["cluster_names"],
                "radar_chart_data": radar_chart_data,
                "agg_df": agg_df,
                "download_filename": result_filename
            }))
        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except Exception as e:
        logger.error(f"クラスタリングAPIエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

# クラスタ抽出API
@clustering_bp.route("/api/cluster/select", methods=["POST"])
def cluster_select():
    try:
        # クラスタ名を受け取る
        data = request.get_json()
        cluster_name = data.get("cluster_name")
        # セッションやグローバルでagg_dfを保持していない場合、都度ファイルアップロードが必要
        # ここでは一時的にグローバル変数でagg_dfを保持する例（本番はセッションやDB推奨）
        # グローバル変数を初期化
        if 'last_agg_df' not in globals():
            global last_agg_df
            last_agg_df = None

        if last_agg_df is None:
            return jsonify({"error": "クラスタリングデータがありません。再度クラスタリングを実行してください。"}), 400
        filtered = [row for row in last_agg_df if row.get("クラスタ名") == cluster_name]
        # filteredの各行のNaNをNoneに変換
        filtered = nan_to_none(filtered)
        # 返却直前にNaN混入チェック
        try:
            json.dumps({"data": filtered}, ensure_ascii=False, allow_nan=False)
        except Exception as e:
            print('JSON変換エラー:', e)
            print('filtered:', filtered)
        return jsonify(nan_to_none({"data": filtered}))
    except Exception as e:
        logger.error(f"クラスタ抽出APIエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@clustering_bp.route("/api/cluster/download/<filename>", methods=["GET"])
def download_clustering_result(filename):
    """クラスタリング結果のダウンロード"""
    try:
        file_path = os.path.join(tempfile.gettempdir(), filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "ファイルが見つかりません"}), 404

        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
    except Exception as e:
        logger.error(f"クラスタリング結果ダウンロードエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@clustering_bp.route("/api/cluster/convert-for-pos", methods=["POST"])
def convert_clustering_for_pos():
    """クラスタリング結果をPOSデータ前処理用に変換"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "ファイルが必要です"}), 400

        file = request.files["file"]
        # ファイルの内容を完全にコピーしてから処理
        file_content = file.read()
        if file_content is None:
            raise ValueError('ファイル内容が空です')

        # 完全に独立したバイト列として保存
        if isinstance(file_content, bytes):
            file_bytes_for_thread = file_content
        elif isinstance(file_content, str):
            file_bytes_for_thread = file_content.encode('utf-8')
        else:
            file_bytes_for_thread = str(file_content).encode('utf-8')

        # 完全に独立したコピーを作成
        file_bytes_for_thread = bytes(file_bytes_for_thread)
        filename = file.filename

        # ファイルオブジェクトとfile_contentを明示的にNoneにして参照を断つ
        file = None
        file_content = None

        logger.info(f"ファイル内容読み込み完了: {len(file_bytes_for_thread)} バイト")

        # ファイルを一時的に保存してから読み込み
        temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file.write(file_bytes_for_thread)
        temp_file.flush()
        temp_file.close()

        try:
            # ファイル読み込み
            if filename and isinstance(filename, str) and filename.endswith(".csv"):
                df = pd.read_csv(temp_file.name)
            else:
                df = pd.read_excel(temp_file.name)

            # クラスタリング結果をPOSデータ形式に変換
            # 各クラスタの顧客データを生成
            pos_data = []

            for _, row in df.iterrows():
                customer_id = row.get('カード番号', row.get('会員番号', f'customer_{row.name}'))
                cluster_name = row.get('クラスタ名', 'Unknown')

                # クラスタごとの特徴に基づいてPOSデータを生成
                # 利用回数、総利用金額、平均利用金額などの情報を使用
                usage_count = row.get('利用回数', row.get('回数', 5))
                if usage_count is None:
                    usage_count = 5
                total_amount = row.get('総利用金額', row.get('合計金額', 10000))
                if total_amount is None:
                    total_amount = 10000
                avg_amount = row.get('平均利用金額', row.get('平均金額', 2000))
                if avg_amount is None:
                    avg_amount = 2000
                max_amount = row.get('最大利用金額', row.get('最大金額', 5000))
                if max_amount is None:
                    max_amount = 5000
                peak_hour = row.get('最頻時間帯', 12)
                if peak_hour is None:
                    peak_hour = 12

                # 各利用についてPOSデータを生成
                for i in range(int(usage_count)):
                    # 時間帯に基づいて利用日時を生成
                    import random
                    from datetime import datetime, timedelta

                    # 過去30日以内のランダムな日付
                    random_date = datetime.now() - timedelta(days=random.randint(1, 30))
                    # 最頻時間帯を中心とした時間
                    hour = max(0, min(23, peak_hour + random.randint(-2, 2)))
                    use_datetime = random_date.replace(hour=hour, minute=random.randint(0, 59))

                    # 利用金額（平均金額を中心としたランダム値）
                    amount = max(100, int(avg_amount * random.uniform(0.5, 1.5)))

                    # ショップ名（クラスタ名に基づいて生成）
                    shop_names = {
                        '高額利用者': ['高級ブランド店', 'ジュエリーショップ', '高級レストラン'],
                        '頻繁利用者': ['コンビニ', 'スーパーマーケット', 'ドラッグストア'],
                        '昼間利用者': ['カフェ', 'ランチレストラン', '美容院'],
                        '夜間利用者': ['居酒屋', 'バー', 'カラオケ']
                    }

                    default_shops = ['ショップA', 'ショップB', 'ショップC']
                    available_shops = shop_names.get(cluster_name, default_shops)
                    shop_name = random.choice(available_shops)

                    pos_data.append({
                        'カード番号': customer_id,
                        '利用日時': use_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                        '利用金額': amount,
                        'ショップ名略称': shop_name
                    })

            # 変換されたPOSデータをCSVとして保存
            converted_df = pd.DataFrame(pos_data)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            result_filename = f"converted_pos_data_{timestamp}.csv"
            file_path = os.path.join(tempfile.gettempdir(), result_filename)
            converted_df.to_csv(file_path, index=False, encoding='utf-8-sig')

            # previewのNaNをNoneに変換
            preview_df = converted_df.head(10)
            preview = safe_df_to_dict(preview_df)

            return jsonify(nan_to_none({
                "message": "クラスタリング結果をPOSデータ形式に変換しました",
                "filename": result_filename,
                "row_count": len(converted_df),
                "preview": preview
            }))

        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)

    except Exception as e:
        logger.error(f"クラスタリング結果変換エラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500
