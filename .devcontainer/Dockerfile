FROM python:3.11-slim

# 必要パッケージのインストール（Node.js対応含む）
RUN apt-get update && apt-get install -y \
  build-essential \
  curl \
  git \
  vim \
  ca-certificates \
  gnupg \
  && apt-get clean

# Node.js 18.x のインストール（React用）
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
  apt-get install -y nodejs && \
  npm install -g npm

# Pythonライブラリ（Jupyter, Flaskなど）をインストール
RUN pip install --no-cache-dir \
  flask \
  gunicorn \
  jupyterlab \
  ipykernel \
  notebook

# Jupyterのカーネル登録
RUN python -m ipykernel install --user

# 作業ディレクトリ
WORKDIR /workspace

EXPOSE 8888
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--allow-root", "--NotebookApp.token=''", "--NotebookApp.password=''"]
