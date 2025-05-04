import os
from flask import render_template, send_from_directory

def register_frontend(app):
    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/<path:path>")
    def static_proxy(path):
        file_path = os.path.join(app.template_folder, path)
        if os.path.exists(file_path):
            return send_from_directory(app.template_folder, path)
        return render_template("index.html")
