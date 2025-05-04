import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from io import BytesIO
from flask import jsonify, send_file
import math

def _normalize_dataframe(df, metrics):
    df_norm = df.copy()
    for m in metrics:
        df_norm[m] = np.log1p(df_norm[m])
        df_norm[m] = (df_norm[m] - df_norm[m].min()) / (df_norm[m].max() - df_norm[m].min())
    return df_norm

def generate_radar_chart(request):
    try:
        f = request.files.get("file")
        if not f or not f.filename:
            return jsonify({"error": "file_required"}), 400
        df = pd.read_csv(f) if f.filename.endswith(".csv") else pd.read_excel(f, sheet_name="船橋衣料品")
        metrics = ["ユニーク客数", "売上", "平均頻度(日数/ユニーク客数)", "1日あたり購買金額", "日別合計媒介中心"]
        tenants = ["ﾕﾆｸﾛ", "ｱｶﾁｬﾝﾎﾝﾎﾟ", "ZARA", "ABC-MART GRAND STAGE", "THE NORTH FACE +", "DIESEL"]
        df_norm = _normalize_dataframe(df, metrics)
        plot_df = df_norm[df_norm["テナント名"].isin(tenants)]

        plt.figure(figsize=(6, 6))
        ax = plt.subplot(111, polar=True)
        angles = [n / float(len(metrics)) * 2 * math.pi for n in range(len(metrics))]
        angles += angles[:1]

        for tenant in tenants:
            row = plot_df[plot_df["テナント名"] == tenant].iloc[0]
            values = row[metrics].tolist() + [row[metrics[0]]]
            ax.plot(angles, values, linewidth=1, linestyle="solid", label=tenant)
            ax.fill(angles, values, alpha=0.1)

        ax.set_theta_offset(math.pi / 2)
        ax.set_theta_direction(-1)
        plt.xticks(angles[:-1], metrics, fontsize=9)
        ax.set_rlabel_position(0)
        plt.yticks([0.25, 0.5, 0.75, 1.0], fontsize=7)
        ax.set_ylim(0, 1)
        plt.title("Log‑norm Radar Chart", y=1.1)
        plt.legend(loc="upper right", bbox_to_anchor=(1.2, 1.1))

        buf = BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)
        plt.close()
        return send_file(buf, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_json_data(request):
    try:
        f = request.files.get("file")
        if not f or not f.filename:
            return jsonify({"error": "file_required"}), 400
        df = pd.read_csv(f) if f.filename.endswith(".csv") else pd.read_excel(f, sheet_name="船橋衣料品")
        metrics = ["ユニーク客数", "売上", "平均頻度(日数/ユニーク客数)", "1日あたり購買金額", "日別合計媒介中心"]
        tenants = ["ﾕﾆｸﾛ", "ｱｶﾁｬﾝﾎﾝﾎﾟ", "ZARA", "ABC-MART GRAND STAGE", "THE NORTH FACE +", "DIESEL"]
        df_norm = _normalize_dataframe(df, metrics)
        plot_df = df_norm[df_norm["テナント名"].isin(tenants)]

        out = []
        for m in metrics:
            row = {"metric": m}
            for t in tenants:
                v = plot_df[plot_df["テナント名"] == t][m].values
                row[t] = round(float(v[0]), 3) if len(v) else 0
            out.append(row)

        return jsonify({"data": out, "tenants": tenants})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

