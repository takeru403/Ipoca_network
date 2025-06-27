# split_requirements.py

from pathlib import Path

# 入力ファイルパス
input_file = "requirements.lock"

# 出力ファイルパス
core_file = "requirements_core.txt"
extra_file = "requirements_extra.txt"

# 重いパッケージに含まれるキーワード（ここは必要に応じて調整可能）
heavy_keywords = [
    "torch", "tensorflow", "jax", "transformers", "onnx", "chromadb", "chromahnswlib",
    "grpcio", "jupyterlab", "notebook", "matplotlib", "scipy", "duckdb",
    "tokenizers", "numpy", "pandas", "openai", "langchain", "tiktoken"
]

# 分類用リスト
core = []
extra = []

# 読み込みと分類
with open(input_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if any(keyword in line.lower() for keyword in heavy_keywords):
            extra.append(line)
        else:
            core.append(line)

# ファイルに保存
with open(core_file, "w", encoding="utf-8") as f:
    f.write("\n".join(core) + "\n")

with open(extra_file, "w", encoding="utf-8") as f:
    f.write("\n".join(extra) + "\n")

print(f"✅ 分類完了: 軽量 {len(core)} 件 → {core_file}, 重量 {len(extra)} 件 → {extra_file}")
