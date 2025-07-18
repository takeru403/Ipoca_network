import os
from flask import Flask
from flask_cors import CORS
from .config import Config
from .models import db
from flask_migrate import Migrate

def create_app():
    app = Flask(
        __name__,
        static_folder = "../frontend/build/static",
        template_folder = "../frontend/build"
    )
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
        "https://asushiru-pos.com"  # 本番ドメインを追加
    ])
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
    # Lambda環境ではデータベース機能を無効化
    if not os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
        db.init_app(app)
        Migrate(app, db)
        with app.app_context():
            db.create_all()

    @app.route("/")
    def index():
        try:
            return "OK"
        except Exception as e:
            import traceback
            error_msg = f"Error: {str(e)}\nTraceback: {traceback.format_exc()}"
            print(error_msg)  # CloudWatch Logsに出力
            return f"Error: {str(e)}", 500

    @app.errorhandler(500)
    def internal_error(error):
        import traceback
        error_msg = f"500 Error: {str(error)}\nTraceback: {traceback.format_exc()}"
        print(error_msg)  # CloudWatch Logsに出力
        return f"Internal Server Error: {str(error)}", 500
    
    return app
