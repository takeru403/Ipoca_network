import os
from flask import Flask

def create_app():
    try:
        print("Creating Flask app...")
        app = Flask(__name__)
        
        print("Setting up basic config...")
        app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'dev-key')
        
        print("Lambda environment check...")
        is_lambda = os.environ.get('AWS_LAMBDA_FUNCTION_NAME')
        print(f"Is Lambda: {bool(is_lambda)}")
        
        if is_lambda:
            print("Lambda environment detected - minimal setup")
            # Lambda環境では最小限の設定のみ
            @app.route("/")
            def index():
                return "Lambda OK"
        else:
            print("Local environment detected - full setup")
            # ローカル環境では全機能
            from flask_cors import CORS
            from .config import Config
            from .models import db
            from flask_migrate import Migrate
            
            app.config.from_object(Config)
            app.secret_key = Config.SECRET_KEY
            app.config.update({
                "SESSION_COOKIE_SAMESITE": "Lax",
                "SESSION_COOKIE_SECURE": False,
                "SESSION_COOKIE_HTTPONLY": True,
            })
            CORS(app, supports_credentials=True, origins=[
                "http://localhost:3000", "http://localhost:5000",
                "http://127.0.0.1:3000", "http://127.0.0.1:5000",
                "https://asushiru-pos.com"
            ])
            
            # ブループリントの登録
            from .auth.routes import auth_bp
            from .upload.routes import upload_bp
            from .frontend import register_frontend
            from .network.routes import network_bp
            from .search.routes import search_bp
            from .mindmap.routes import mindmap_bp
            from .posdata.routes import posdata_bp
            from .clustering.routes import clustering_bp
            from .factpanel.routes import factpanel_bp
            from .note.routes import note_bp
            from .voice_narration.routes import voice_narration_bp
            
            app.register_blueprint(auth_bp)
            app.register_blueprint(network_bp)
            app.register_blueprint(search_bp)
            app.register_blueprint(upload_bp)
            app.register_blueprint(mindmap_bp)
            app.register_blueprint(posdata_bp)
            app.register_blueprint(clustering_bp)
            app.register_blueprint(factpanel_bp)
            app.register_blueprint(note_bp)
            app.register_blueprint(voice_narration_bp)
            register_frontend(app)
            
            # データベース初期化
            db.init_app(app)
            Migrate(app, db)
            with app.app_context():
                db.create_all()
            
            @app.route("/")
            def index():
                return "Local OK"
        
        print("Flask app created successfully")
        return app
        
    except Exception as e:
        import traceback
        error_msg = f"Error creating app: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(error_msg)
        # エラーが発生してもFlaskアプリを返す
        app = Flask(__name__)
        app.config['SECRET_KEY'] = 'fallback-key'
        
        @app.route("/")
        def error_index():
            return f"Error: {str(e)}", 500
        
        return app
