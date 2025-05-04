from flask import Flask
from flask_cors import CORS
from .config import Config

def create_app():
  ### run.pyで最初に呼び出される関数。
  app = Flask(
    __name__, # __main__というモジュール名が入っている。
    static_folder = "../frontend/build/static",
    template_folder = "../frontend/build"
  )
  app.secret_key = Config.SECRET_KEY
  app.config.update(Config.SESSION_CONFIG)
  #
  CORS(app, supports_credentials=True)

  # Blueprint 登録
  # 各機能を分割したモジュールをインポートして、flaskアプリに登録する。
  from .auth.routes import auth_bp
  from .search.routes import search_bp
  from .upload.routes import upload_bp
  from .frontend import register_frontend
  from .network.routes import network_bp
  app.register_blueprint(auth_bp)
  app.register_blueprint(network_bp)
  app.register_blueprint(search_bp)
  app.register_blueprint(upload_bp)
  register_frontend(app)

  return app
