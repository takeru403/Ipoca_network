from flask import Flask
from flask_cors import CORS
from .config import Config
from .models import db
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

#db = SQLAlchemy()  # DBの作成
migrate = Migrate()  # Flask-Migrateのインスタンスを作成

def create_app():
  ### run.pyで最初に呼び出される関数。
  app = Flask(
    __name__, # __main__というモジュール名が入っている。
    static_folder = "../frontend/build/static",
    template_folder = "../frontend/build"
  )
# Configクラスから設定を読み込む。
  app.config.from_object(Config)

  app.secret_key = Config.SECRET_KEY
  #app.config.update(Config.SESSION_CONFIG)
  app.config.update({
      "SESSION_COOKIE_SAMESITE": "None",  # クロスオリジンCookie許可
      "SESSION_COOKIE_SECURE": False      # HTTPで開発するならFalse、本番HTTPSならTrue
  })
  CORS(app, supports_credentials=True, origins=["http://54.168.159.57"])

  # Blueprint 登録
  # 各機能を分割したモジュールをインポートして、flaskアプリに登録する。
  from .auth.routes import auth_bp
 # from .search.routes import search_bp
  from .upload.routes import upload_bp
  from .frontend import register_frontend
  from .network.routes import network_bp
  #from .search.service import search_bp
  from .search.routes import search_bp
  from .mindmap.routes import mindmap_bp
  app.register_blueprint(auth_bp)
  app.register_blueprint(network_bp)
  app.register_blueprint(search_bp)
  app.register_blueprint(upload_bp)
  app.register_blueprint(mindmap_bp)
  register_frontend(app)

  # DBの初期化
  db.init_app(app)
  migrate.init_app(app, db)

  with app.app_context():
      db.create_all()  # DBの初期化

  return app
