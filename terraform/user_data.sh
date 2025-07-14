#!/bin/bash
# 必要なパッケージをインストール
yum update -y
yum install -y python3 git nodejs gcc-c++ make

# Python パッケージインストール
pip3 install --upgrade pip
pip3 install flask gunicorn

# アプリ用ディレクトリを作成して移動
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# GitHub からプロジェクトをクローン（★ここにあなたのURLを入れる）
git clone https://github.com/takeru403/Ipoca_network
# または ssh 方式でもOK: git@github.com:takeru/ipoca_network.git

# React のビルド（frontend ディレクトリがある前提）
cd Ipoca_network
cd frontend
npm install
export NODE_OPTIONS=--max-old-space-size=4096
npm run build
cd ..

# React ビルドファイルを Flask にコピー（static / templates ディレクトリへ）
mkdir -p app/static app/templates
cp -r frontend/build/static/* app/static/
cp frontend/build/index.html app/templates/

# Flaskアプリ起動
cd app
gunicorn -b 0.0.0.0:80 app:app --daemon
