import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv("../.env"))
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "PLEASE_CHANGE_ME")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    SESSION_CONFIG = {
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": True,
    }
    # DB周りの設定。
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(basedir, 'app.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
