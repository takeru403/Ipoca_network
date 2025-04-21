# ──────────────────────────────
# ベースイメージ
# ──────────────────────────────
FROM python:3.11-slim

# タイムゾーンや PYTHONUTF8 を固定しておくとログが化けにくい
ENV TZ=Asia/Tokyo \
  PYTHONUNBUFFERED=1 \
  PIP_NO_CACHE_DIR=1 \
  PIP_DISABLE_PIP_VERSION_CHECK=1

# ──────────────────────────────
# Linux パッケージ & Node.js
# ──────────────────────────────
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  git \
  ca-certificates \
  gnupg && \
  # NodeSource の GPG & リポジトリ登録
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
  apt-get install -y --no-install-recommends nodejs && \
  npm install -g npm && \
  # キャッシュ削減
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# ── Python 依存 ─────────────────
#   ワークスペース直下の requirements.txt をコピー
COPY requirements.lock /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.lock && rm /tmp/requirements.lock

# ── ソースコード ─────────────────
WORKDIR /workspace
# .devcontainer より上位の全ディレクトリ内容をコピー
COPY . /workspace

EXPOSE 8000
CMD ["python", "app/app.py", "--host", "0.0.0.0", "--port", "8000"]
