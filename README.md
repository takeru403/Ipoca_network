# プロジェクト概要

このプロジェクトは、**Flask + React** 構成のWebアプリケーションと、そのAWSインフラ（Terraform管理）、データ分析用ノートブック、各種データセットを含む総合的なシステムです。

---

## ディレクトリ構成

```
.
├── app/           # Flaskバックエンド（API, DB, 各種機能モジュール）
├── frontend/      # Reactフロントエンド
├── terraform/     # AWSインフラ構築用Terraformコード
├── data/          # データセット（CSV等）
├── notebook/      # データ分析・実験用Jupyterノートブック
├── run.py         # Flaskアプリ起動スクリプト
├── requirements.txt # Python依存パッケージ
└── ...            # その他ログ・資料等
```

---

## セットアップ手順

### 1. インフラ構築（AWS）

1. `terraform/terraform.tfvars` を編集し、AMI IDやキーペア名等を自分の環境に合わせて設定
2. Terraform初期化・適用
   ```sh
   cd terraform
   terraform init
   terraform apply
   ```
3. EC2インスタンスが起動し、Flaskアプリが自動デプロイされます

---

### 2. バックエンド（Flask API）

1. 必要なPythonパッケージをインストール
   ```sh
   pip install -r requirements.txt
   ```
2. アプリ起動
   ```sh
   python run.py
   ```
   - デフォルトで `http://localhost:5000` でAPIが起動

---

### 3. フロントエンド（React）

1. 依存パッケージインストール
   ```sh
   cd frontend
   npm install
   ```
2. 開発サーバ起動
   ```sh
   npm start
   ```
   - `http://localhost:3000` でフロントエンドが起動
   - バックエンドAPI（Flask）と連携

---

### 4. データ分析・ノートブック

- `notebook/` 配下にJupyter Notebook（例: `eda.ipynb`, `main.ipynb` など）があり、データ分析や可視化が可能
- 必要に応じてJupyter Lab/Notebookを起動し、各ノートブックを実行

---

## 主な機能

- **ユーザー認証・ファイルアップロード・データ検索・可視化（レーダーチャート等）**
- **ネットワーク分析・クラスタリング・ナレーション生成（音声合成）**
- **データセット管理・分析用ノートブック**
- **AWS上での自動デプロイ（Terraform）**

---

## 依存技術

- **バックエンド:** Python, Flask, SQLAlchemy, Flask-Migrate, Flask-CORS など
- **フロントエンド:** React, Chart.js, recharts, d3, xlsx など
- **インフラ:** AWS（EC2, VPC, Subnet, SG, EIP等）, Terraform
- **データ分析:** Jupyter Notebook, pandas, numpy など

---

## 注意事項

- `app.db` など大容量ファイルや機密情報はGit管理対象外にしてください
- AWSリソースの削除は `terraform destroy` で行えます
- EC2のSSH鍵は事前にAWSで作成し、`terraform.tfvars` で指定してください

---

## ライセンス・参考

- 本プロジェクトは教育・研究用途を想定しています
- [Terraform公式ドキュメント](https://developer.hashicorp.com/terraform/docs)
- [Flask公式ドキュメント](https://flask.palletsprojects.com/ja/2.0.x/)
- [React公式ドキュメント](https://react.dev/)
