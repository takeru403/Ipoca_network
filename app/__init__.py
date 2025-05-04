from flask import Flask
from flask_cors import CORS
from .config import Config

def create_app():
  app = Flask(
    __name__,
    static_folder = "../frontend/build/static",
    template_folder = "../frontend/build"
  )
  app.secret_key = Config.SECRET_KEY
  app.config.update(Config.SESSION_CONFIG)
  CORS(app, supports_credentials=True)

  # Blueprint 登録
  from .auth.routes import auth_bp
  from .search.routes import search_bp
  from .upload.routes import upload_bp
  from .frontend import register_frontend

  app.register_blueprint(auth_bp)
  app.register_blueprint(search_bp)
  app.register_blueprint(upload_bp)
  register_frontend(app)

  return app
