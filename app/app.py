from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from langchain_community.vectorstores import Chroma
from langchain.schema import Document
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv, find_dotenv
import os
from datetime import timedelta


# .env読み込み
dotenv_path = find_dotenv("../.env")
load_dotenv(dotenv_path=dotenv_path)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Flaskアプリ設定
app = Flask(
    __name__,
    static_folder="../frontend/build/static",
    template_folder="../frontend/build"
)
app.secret_key = "supersecretkey"

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=10)
app.config['SESSION_PERMANENT'] = False  # セッションはブラウザ閉じると消える

# SQLAlchemy設定
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
db = SQLAlchemy(app)

# Flask-Login設定
login_manager = LoginManager()
login_manager.login_view = "login"
login_manager.init_app(app)

# ユーザーモデル
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

# 初回起動時にDBとユーザー作成
with app.app_context():
    db.create_all()
    if not User.query.filter_by(username="ipoca_test").first():
        user = User(
            username="ipoca_test",
            password_hash=generate_password_hash("ipoca_test")
        )
        db.session.add(user)
        db.session.commit()

# ユーザー読み込み関数
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ログインAPI
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        login_user(user)
        return jsonify({"message": "ログイン成功"})
    return jsonify({"error": "IDまたはパスワードが間違っています"}), 401

# ログアウトAPI
@app.route("/api/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "ログアウトしました"})

# Reactのルーティング
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/<path:path>")
def static_proxy(path):
    file_path = os.path.join(app.template_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.template_folder, path)
    else:
        return render_template("index.html")

# スライド検索API（ログイン必須）
SCOPES = ["https://www.googleapis.com/auth/presentations.readonly"]
PRESENTATION_ID = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds"

@app.route("/api/search", methods=["POST"])
@login_required
def search():
    query = request.json.get("query", "")
    if not query:
        return jsonify({"error": "query not provided"}), 400

    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    service = build("slides", "v1", credentials=creds)
    presentation = service.presentations().get(presentationId=PRESENTATION_ID).execute()
    slides = presentation.get("slides")

    slide_texts = []
    for slide in slides:
        text_elements = []
        for element in slide.get("pageElements", []):
            shape = element.get("shape")
            if shape and "text" in shape:
                text = shape["text"].get("textElements", [])
                for t in text:
                    if "textRun" in t:
                        text_elements.append(t["textRun"]["content"])
        slide_texts.append("".join(text_elements))

    documents = [Document(page_content=slide_texts[i], metadata={"slide_index": i}) for i in range(len(slide_texts))]
    embedding_function = OpenAIEmbeddings(api_key=OPENAI_API_KEY)
    vectorstore = Chroma.from_documents(documents, embedding_function)
    results = vectorstore.similarity_search_with_score(query, k=3)

    return jsonify([
        {
            "slide_index": doc.metadata["slide_index"] + 1,
            "content": doc.page_content,
            "score": score
        }
        for doc, score in results
    ])

# アプリ起動
if __name__ == "__main__":
    app.run(debug=True)
