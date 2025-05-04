import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv("../.env"))

class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "PLEASE_CHANGE_ME")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    SESSION_CONFIG = {
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": True,
    }
