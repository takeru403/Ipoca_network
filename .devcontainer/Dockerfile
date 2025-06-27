# syntax=docker/dockerfile:1
FROM python:3.11-slim

# 必要なパッケージのインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    vim \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# pipアップグレード & coreパッケージインストール
COPY requirements_core.txt /tmp/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements_core.txt

# 作業ディレクトリ作成
WORKDIR /workspace
