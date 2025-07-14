from flask import Blueprint, request, jsonify, send_file
from app.decorators import login_required
from .pos_preprocessing import calc_asociation, build_node_edge_df, process_pos_data_background, llm_column_mapping, REQUIRED_COLUMNS
import pandas as pd
import io
import tempfile
import os
import logging
import json
import threading
from datetime import datetime
import time
import traceback
import copy
import numpy as np
from collections import Counter
import math

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

posdata_bp = Blueprint("posdata", __name__)

# 処理状態を保存するグローバル辞書
processing_status = {}

# 自動処理用のグローバル変数
auto_processing_data = {}

def nan_to_none(obj):
    if isinstance(obj, float) and (math.isnan(obj) or obj is np.nan):
        return None
    elif isinstance(obj, dict):
        return {k: nan_to_none(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [nan_to_none(x) for x in obj]
    else:
        return obj

# --- ここからグローバルに移動（import文の直後） ---
def background_auto_process_independent(file_bytes, filename, column_mapping, process_id, start_time):
    try:
        logger.info(f"自動処理開始: {process_id}")
        temp_file_pos = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file_cluster = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        temp_file_network = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv')
        logger.info(f"一時ファイル作成: POS={temp_file_pos.name}, Cluster={temp_file_cluster.name}, Network={temp_file_network.name}")
        temp_file_pos.write(file_bytes)
        temp_file_cluster.write(file_bytes)
        temp_file_network.write(file_bytes)
        temp_file_pos.flush()
        temp_file_cluster.flush()
        temp_file_network.flush()
        temp_file_pos.close()
        temp_file_cluster.close()
        temp_file_network.close()
        logger.info("ファイル保存完了")
        try:
            processing_status[process_id].update({
                "progress": 10,
                "message": "POSデータ前処理を実行中...",
                "current_step": "POSデータ前処理"
            })
            logger.info("POSデータ前処理開始")
            if filename and isinstance(filename, str) and filename.endswith(".csv"):
                df_pos = pd.read_csv(temp_file_pos.name)
            else:
                df_pos = pd.read_excel(temp_file_pos.name)
            logger.info(f"POSファイル読み込み完了: {len(df_pos)} 行")
            # --- カテゴリ列のユニーク値取得ロジックを修正 ---
            category_col = None
            for k, v in column_mapping.items():
                if v == "カテゴリ":
                    category_col = k
                    break
            if category_col and category_col in df_pos.columns:
                categories = df_pos[category_col].dropna().unique().tolist()
            else:
                categories = []
            rules = calc_asociation(df_pos, min_support=0.0001, max_len=2)
            logger.info(f"アソシエーション分析完了: {len(rules)} ルール")
            for col in ['antecedents', 'consequents', 'lift']:
                if col not in rules.columns:
                    rules[col] = np.nan
            rules_df = rules
            rules_list = list(rules_df.itertuples(index=False, name=None))
            node_df, edge_df = build_node_edge_df(rules_df, "mall_name")
            if not isinstance(node_df, pd.DataFrame):
                node_list = list(node_df)
                node_df_df = pd.DataFrame(node_list)
            else:
                node_df_df = node_df
                node_list = list(node_df_df.itertuples(index=False, name=None))
            if not isinstance(edge_df, pd.DataFrame):
                edge_list = list(edge_df)
                edge_df_df = pd.DataFrame(edge_list)
            else:
                edge_df_df = edge_df
                edge_list = list(edge_df_df.itertuples(index=False, name=None))
            logger.info(f"ノード・エッジ作成完了: {len(node_df_df)} ノード, {len(edge_df_df)} エッジ")
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            pos_filename = f"pos_processed_{timestamp}.csv"
            pos_file_path = os.path.join(tempfile.gettempdir(), pos_filename)
            rules_df = rules_df.where(pd.notnull(rules_df), None)
            rules_df.to_csv(pos_file_path, index=False, encoding='utf-8-sig')
            logger.info(f"POS結果保存完了: {pos_file_path}")
            processing_status[process_id].update({
                "progress": 30,
                "message": "クラスタリングを実行中...",
                "current_step": "クラスタリング"
            })
            logger.info("クラスタリング開始")
            from app.clustering.make_clustring import cluster_main
            logger.info("顧客属性データ変換開始")
            customer_data = df_pos.groupby('カード番号').agg({
                '利用金額': ['count', 'sum', 'mean', 'max'],
                '利用日時': lambda x: pd.to_datetime(x).dt.hour.mode().iloc[0] if len(x) > 0 else 0
            }).reset_index()
            customer_data.columns = ['カード番号', '利用回数', '総利用金額', '平均利用金額', '最大利用金額', '最頻時間帯']
            clustering_result = cluster_main(customer_data, n_clusters=4)
            cluster_filename = f"clustering_result_{timestamp}.csv"
            cluster_file_path = os.path.join(tempfile.gettempdir(), cluster_filename)
            clustering_result['agg_df'] = clustering_result['agg_df'].where(pd.notnull(clustering_result['agg_df']), None)
            clustering_result['agg_df'].to_csv(cluster_file_path, index=False, encoding='utf-8-sig')
            logger.info(f"クラスタリング結果保存完了: {cluster_file_path}")
            processing_status[process_id].update({
                "progress": 60,
                "message": "ネットワーク描画を準備中...",
                "current_step": "ネットワーク描画"
            })
            logger.info("ネットワーク描画準備開始")
            from app.network.draw_network import create_network_json
            network_data = create_network_json_from_rules(rules_df)
            logger.info("ネットワークデータ作成完了")
            processing_status[process_id].update({
                "progress": 80,
                "message": "レーダーチャートを準備中...",
                "current_step": "レーダーチャート"
            })
            logger.info("レーダーチャート準備開始")
            tenant_col = None
            for col in ['テナント名', 'ショップ名略称']:
                if col in df_pos.columns:
                    tenant_col = col
                    break
            if tenant_col is None:
                raise ValueError('テナント名またはショップ名略称列が見つかりません')
            date_col = None
            for col in ['利用日', '利用日時']:
                if col in df_pos.columns:
                    date_col = col
                    break
            if date_col is None:
                raise ValueError('利用日または利用日時列が見つかりません')
            member_col = None
            for col in ['会員番号', 'カード番号']:
                if col in df_pos.columns:
                    member_col = col
                    break
            if member_col is None:
                raise ValueError('会員番号またはカード番号列が見つかりません')
            df_pos[date_col] = pd.to_datetime(df_pos[date_col], errors='coerce')
            unique_customers = df_pos.groupby(tenant_col)[member_col].nunique()
            unique_customers.name = 'ユニーク客数'
            sales = df_pos.groupby(tenant_col)['利用金額'].sum()
            sales.name = '売上'
            visit_days = df_pos.groupby(tenant_col)[date_col].nunique()
            visit_days.name = '訪問日数'
            avg_freq = (visit_days / unique_customers)
            avg_freq.name = '平均頻度(日数/ユニーク客数)'
            sales_per_day = (sales / visit_days)
            sales_per_day.name = '1日あたり購買金額'
            import networkx as nx
            G = nx.Graph()
            for _, row in rules_df.iterrows():
                src = str(row['antecedents'])
                dst = str(row['consequents'])
                lift_val = row['lift'] if 'lift' in row else 1.0
                if src and dst and src != dst:
                    G.add_edge(src, dst, weight=lift_val)
            bet_cent = nx.betweenness_centrality(G, weight='weight', normalized=True)
            bc_series = pd.Series(bet_cent, name='日別合計媒介中心')
            metrics_df = pd.concat([
                unique_customers, sales, avg_freq, sales_per_day
            ], axis=1)
            bc_series.index = bc_series.index.astype(str)
            metrics_df.index = metrics_df.index.astype(str)
            metrics_df = metrics_df.join(bc_series, how='left')
            if '日別合計媒介中心' in metrics_df.columns:
                metrics_df['日別合計媒介中心'] = metrics_df['日別合計媒介中心'].fillna(0)
            logger.info(f"metrics_df columns after join: {metrics_df.columns}")
            logger.info(f"metrics_df index after join: {metrics_df.index}")
            metrics_df = metrics_df.reset_index()
            metrics_df = metrics_df.rename(columns={metrics_df.columns[0]: 'テナント名'})
            logger.info(f"metrics_df columns: {metrics_df.columns}")
            if 'テナント名' not in metrics_df.columns:
                raise ValueError(f"metrics_dfにテナント名列が存在しません: {metrics_df.columns}")
            metrics = [
                "ユニーク客数",
                "売上",
                "平均頻度(日数/ユニーク客数)",
                "1日あたり購買金額",
                "日別合計媒介中心"
            ]
            df_norm = metrics_df.copy()
            for m in metrics:
                min_v = df_norm[m].min()
                max_v = df_norm[m].max()
                if max_v > min_v:
                    df_norm[m] = (df_norm[m] - min_v) / (max_v - min_v)
                else:
                    df_norm[m] = 0.0
            tenants = list(df_norm["テナント名"].values)
            radar_chart_data = []
            for metric in metrics:
                row = {"metric": metric}
                for t in tenants:
                    v = df_norm.loc[df_norm["テナント名"] == t, metric].values
                    row[t] = str(float(v[0])) if len(v) else "0.0"
                radar_chart_data.append(row)
            logger.info("レーダーチャートデータ準備完了")
            end_time = time.time()
            processing_time = end_time - start_time
            logger.info(f"全処理完了: {processing_time:.2f}秒")
            auto_processing_data[process_id] = {
                'pos_data': {
                    'filename': pos_filename,
                    'rules_count': len(rules_list),
                    'nodes_count': len(node_list),
                    'edges_count': len(edge_list)
                },
                'clustering_data': {
                    'filename': cluster_filename,
                    'tenants': tenants,
                    'radar_chart_data': radar_chart_data,
                    'agg_df': clustering_result['agg_df'],
                    'cluster_names': clustering_result.get('cluster_names', {})
                },
                'network_data': network_data,
                'processing_time': processing_time,
                'category': categories
            }
            processing_status[process_id].update({
                "status": "completed",
                "progress": 100,
                "message": f"自動処理が完了しました（処理時間: {processing_time:.2f}秒）",
                "current_step": "完了",
                "processing_time": processing_time
            })
        finally:
            for temp_file_path in [temp_file_pos.name, temp_file_cluster.name, temp_file_network.name]:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    logger.info(f"一時ファイル削除完了: {temp_file_path}")
    except Exception as e:
        logger.error(f"自動処理エラー: {str(e)}")
        logger.error(f"エラー詳細: {type(e).__name__}")
        logger.error(f"スタックトレース: {traceback.format_exc()}")
        processing_status[process_id].update({
            "status": "failed",
            "progress": 0,
            "message": f"エラーが発生しました: {str(e)}",
            "current_step": "エラー"
        })
# --- ここまでグローバルに移動 ---

@posdata_bp.route("/api/posdata/upload", methods=["POST"])
@login_required
def upload_posdata():
    try:
        if "file" not in request.files:
            return jsonify({"error": "file_required"}), 400
        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "filename_required"}), 400

        # ファイル内容を読み込み
        logger.info("ファイル内容を読み込み中")
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

        # 一時ファイルを作成してプレビュー用データを取得
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
            preview = df.head(20)
            preview = preview.where(pd.notnull(preview), None)
            preview = preview.to_dict(orient="records")
            columns = list(df.columns)
            return jsonify(nan_to_none({"preview": preview, "columns": columns}))
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except Exception as e:
        logger.error(f"アップロードエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@posdata_bp.route("/api/posdata/process", methods=["POST"])
@login_required
def process_posdata():
    try:
        if "file" not in request.files:
            return jsonify({"error": "file_required"}), 400

        file = request.files["file"]
        column_mapping_str = request.form.get("column_mapping", "{}")
        min_support = float(request.form.get("min_support", "0.0001"))
        max_len = int(request.form.get("max_len", "2"))

        # ファイル内容を一時保存して列名取得
        file_content = file.read()
        if file_content is None:
            raise ValueError('ファイル内容が空です')
        if isinstance(file_content, bytes):
            file_bytes_for_thread = file_content
        elif isinstance(file_content, str):
            file_bytes_for_thread = file_content.encode('utf-8')
        else:
            file_bytes_for_thread = str(file_content).encode('utf-8')
        file_bytes_for_thread = bytes(file_bytes_for_thread)
        filename = file.filename
        file = None
        file_content = None

        # 一時ファイルで列名取得
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
            columns = list(df.columns)
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

        # 列名マッピングの解析（なければLLMで自動マッピング）
        if column_mapping_str and column_mapping_str != "{}":
            column_mapping = json.loads(column_mapping_str)
        else:
            column_mapping = llm_column_mapping(columns)

        # 日本語名（値）が重複している場合はエラーを返す
        value_counts = Counter(column_mapping.values())
        duplicated = [k for k, v in value_counts.items() if v > 1]
        if duplicated:
            return jsonify({"error": f"列名マッピングで重複があります: {duplicated}。1つの日本語名に複数の列を割り当てないでください。"}), 400

        # 必要な列の存在確認
        required_columns = ["カード番号", "利用日時", "利用金額", "ショップ名略称"]
        mapped_columns = set(column_mapping.values())
        missing_columns = [col for col in required_columns if col not in mapped_columns]
        if missing_columns:
            return jsonify({"error": f"必要な列が不足しています: {missing_columns}"}), 400

        # ファイルの内容を完全にコピーしてからバックグラウンド処理に渡す
        file_content = file_bytes_for_thread

        # 完全に独立したバイト列として保存
        if isinstance(file_content, bytes):
            file_bytes_for_thread = file_content
        elif isinstance(file_content, str):
            file_bytes_for_thread = file_content.encode('utf-8')
        else:
            file_bytes_for_thread = str(file_content).encode('utf-8')

        # 完全に独立したコピーを作成
        file_bytes_for_thread = bytes(file_bytes_for_thread)
        filename = filename

        # 処理IDを生成
        process_id = f"pos_process_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # 処理状態を初期化
        processing_status[process_id] = {
            "status": "processing",
            "progress": 0,
            "message": "処理を開始しました"
        }

        # バックグラウンドで処理を実行
        def background_process(file_bytes, filename, column_mapping, min_support, max_len, process_id):
            try:
                # 手動処理でも自動処理と同じロジックを使う
                start_time = time.time()
                background_auto_process_independent(
                    file_bytes=file_bytes,
                    filename=filename,
                    column_mapping=column_mapping,
                    process_id=process_id,
                    start_time=start_time
                )
            except Exception as e:
                logging.error(f"バックグラウンド処理エラー: {str(e)}")
                processing_status[process_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": f"エラーが発生しました: {str(e)}"
                })

        # スレッドでバックグラウンド処理を開始
        thread = threading.Thread(
            target=background_process,
            args=(file_bytes_for_thread, filename, column_mapping, min_support, max_len, process_id)
        )
        thread.daemon = True
        thread.start()

        return jsonify(nan_to_none({
            "message": "処理を開始しました",
            "process_id": process_id
        }))

    except Exception as e:
        logging.error(f"POS data processing error: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@posdata_bp.route("/api/posdata/status/<process_id>", methods=["GET"])
@login_required
def get_processing_status(process_id):
    try:
        if process_id not in processing_status:
            return jsonify(nan_to_none({"error": "処理IDが見つかりません"})), 404

        return jsonify(nan_to_none(processing_status[process_id]))

    except Exception as e:
        logging.error(f"Status check error: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@posdata_bp.route("/api/posdata/download/<filename>", methods=["GET"])
@login_required
def download_processed_data(filename):
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
        logging.error(f"Download error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@posdata_bp.route("/api/posdata/auto-process", methods=["POST"])
@login_required
def auto_process_posdata():
    """POSデータの自動処理（前処理、クラスタリング、ネットワーク描画、レーダーチャート）"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "ファイルが必要です"}), 400

        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "ファイル名が必要です"}), 400

        # パラメータの取得
        column_mapping_str = request.form.get("column_mapping", "{}")
        column_mapping = json.loads(column_mapping_str)

        # ファイルの内容を完全にコピーしてからバックグラウンド処理に渡す
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

        # 処理IDを生成
        process_id = f"auto_process_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        start_time = time.time()

        # 処理状態を初期化
        processing_status[process_id] = {
            "status": "processing",
            "progress": 0,
            "message": "自動処理を開始しました",
            "start_time": start_time,
            "current_step": "POSデータ前処理"
        }

        # スレッドでバックグラウンド処理を開始
        thread = threading.Thread(
            target=background_auto_process_independent,
            args=(file_bytes_for_thread, filename, column_mapping, process_id, start_time)
        )
        thread.daemon = True
        thread.start()

        return jsonify(nan_to_none({
            "message": "自動処理を開始しました",
            "process_id": process_id
        }))

    except Exception as e:
        logging.error(f"自動処理開始エラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@posdata_bp.route("/api/posdata/auto-status/<process_id>", methods=["GET"])
@login_required
def get_auto_processing_status(process_id):
    """自動処理の状態を取得"""
    try:
        if process_id not in processing_status:
            return jsonify(nan_to_none({"error": "処理IDが見つかりません"})), 404

        status = processing_status[process_id].copy()

        # 完了している場合は結果データも含める
        if status.get("status") == "completed" and process_id in auto_processing_data:
            result_data = auto_processing_data[process_id].copy()
            # DataFrameをdictに変換
            if 'clustering_data' in result_data and 'agg_df' in result_data['clustering_data']:
                agg_df = result_data['clustering_data']['agg_df']
                if hasattr(agg_df, 'to_dict'):
                    result_data['clustering_data']['agg_df'] = agg_df.where(pd.notnull(agg_df), None).to_dict(orient='records')
            status["result_data"] = result_data

        return jsonify(nan_to_none(status))

    except Exception as e:
        logging.error(f"自動処理状態確認エラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@posdata_bp.route("/api/posdata/auto-download/<process_id>/<data_type>", methods=["GET"])
@login_required
def download_auto_processed_data(process_id, data_type):
    """自動処理結果のダウンロード"""
    try:
        if process_id not in auto_processing_data:
            return jsonify(nan_to_none({"error": "処理結果が見つかりません"})), 404

        data = auto_processing_data[process_id]

        # CSVダウンロード（従来通り）
        if data_type == "pos":
            filename = data['pos_data']['filename']
            file_path = os.path.join(tempfile.gettempdir(), filename)
            if not os.path.exists(file_path):
                return jsonify(nan_to_none({"error": "ファイルが見つかりません"})), 404
            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename,
                mimetype='text/csv'
            )
        elif data_type == "clustering":
            # クラスタリングのJSONデータ返却
            clustering_data = data.get('clustering_data', {})
            # agg_dfがDataFrameならdictに変換
            if 'agg_df' in clustering_data and hasattr(clustering_data['agg_df'], 'to_dict'):
                clustering_data['agg_df'] = clustering_data['agg_df'].where(pd.notnull(clustering_data['agg_df']), None).to_dict(orient='records')
            # cluster_namesやradar_chart_dataも含めて返す
            return jsonify(nan_to_none({
                'agg_df': clustering_data.get('agg_df', []),
                'cluster_names': clustering_data.get('cluster_names', {}),
                'radar_chart_data': clustering_data.get('radar_chart_data', []),
                'download_filename': clustering_data.get('filename', None),
                'tenants': clustering_data.get('tenants', [])
            }))
        elif data_type == "network":
            # ネットワークデータ（nodes, links）をJSONで返す
            network_data = data.get('network_data', {})
            return jsonify(nan_to_none(network_data))
        elif data_type == "radar":
            # レーダーチャートデータをJSONで返す
            clustering_data = data.get('clustering_data', {})
            radar_data = clustering_data.get('radar_chart_data', [])
            # テナント名リストや選択テナントも返す（必要に応じて）
            tenants = list(clustering_data['tenants']) if 'tenants' in clustering_data else []
            selected_tenants = tenants[:5] if tenants else []
            return jsonify(nan_to_none({
                'radar_data': radar_data,
                'tenants': tenants,
                'selected_tenants': selected_tenants
            }))
        else:
            return jsonify(nan_to_none({"error": "無効なデータタイプです"})), 400

    except Exception as e:
        logging.error(f"自動処理結果ダウンロードエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

@posdata_bp.route("/api/posdata/llm-mapping", methods=["POST"], strict_slashes=False)
@login_required
def llm_mapping_api():
    try:
        data = request.get_json()
        columns = data.get("columns", [])
        if not columns or not isinstance(columns, list):
            return jsonify(nan_to_none({"error": "columnsリストが必要です"})), 400
        mapping = llm_column_mapping(columns)
        return jsonify(nan_to_none({"mapping": mapping}))
    except Exception as e:
        logger.error(f"LLMマッピングAPIエラー: {str(e)}")
        return jsonify(nan_to_none({"error": str(e)})), 500

def create_network_json_from_rules(rules):
    """アソシエーションルールからネットワークデータを作成"""
    try:
        import networkx as nx
        from networkx.algorithms import community

        # グラフの構築
        G = nx.Graph()
        for _, row in rules.iterrows():
            source = str(row["antecedents"]).strip()
            target = str(row["consequents"]).strip()
            weight = float(row["lift"])

            if source and target and source != target:
                G.add_edge(source, target, weight=weight)

        if len(G.nodes()) == 0:
            return {"nodes": [], "links": []}

        # 中心性指標の計算
        try:
            betweenness = nx.betweenness_centrality(G, weight="weight", normalized=True)
        except:
            betweenness = nx.betweenness_centrality(G, normalized=True)

        try:
            degree = nx.degree_centrality(G)
        except:
            degree = {node: 0 for node in G.nodes()}

        try:
            closeness = nx.closeness_centrality(G, distance="weight")
        except:
            closeness = nx.closeness_centrality(G)

        try:
            eigenvector = nx.eigenvector_centrality_numpy(G, weight="weight")
        except:
            eigenvector = {node: 0 for node in G.nodes()}

        # コミュニティ検出
        try:
            communities = list(community.greedy_modularity_communities(G, weight="weight"))
        except:
            communities = list(community.greedy_modularity_communities(G))

        node_community = {n: cid for cid, com in enumerate(communities) for n in com}

        # 店舗ごとのrevenueを集計
        shop_revenue = {}
        if 'antecedent_revenue' in rules.columns and 'consequent_revenue' in rules.columns:
            for _, row in rules.iterrows():
                antecedent = str(row["antecedents"]).strip()
                consequent = str(row["consequents"]).strip()
                antecedent_revenue = float(row.get("antecedent_revenue", 0) or 0)
                consequent_revenue = float(row.get("consequent_revenue", 0) or 0)
                if antecedent not in shop_revenue:
                    shop_revenue[antecedent] = antecedent_revenue
                if consequent not in shop_revenue:
                    shop_revenue[consequent] = consequent_revenue

        # ノードデータの作成
        nodes = [
            {
                "id": n,
                "betweenness": float(betweenness.get(n, 0)),
                "degree": float(degree.get(n, 0)),
                "closeness": float(closeness.get(n, 0)),
                "eigenvector": float(eigenvector.get(n, 0)),
                "group": int(node_community.get(n, 0)),
                "revenue": float(shop_revenue.get(n, 0))
            }
            for n in G.nodes()
        ]

        # リンクデータの作成
        links = [
            {
                "source": u,
                "target": v,
                "value": float(d.get("weight", 1))
            }
            for u, v, d in G.edges(data=True)
        ]

        return {"nodes": nodes, "links": links}

    except Exception as e:
        logging.error(f"ネットワークデータ作成エラー: {str(e)}")
        return {"nodes": [], "links": []}
