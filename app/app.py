from flask import Flask, send_from_directory, render_template
import os

app = Flask(
    __name__,
    static_folder="../frontend/build/static",
    template_folder="../frontend/build"
)

@app.route("/")
def index():
    return render_template("index.html")

# Reactのルーティング対応（SPA）
@app.route("/<path:path>")
def static_proxy(path):
    file_path = os.path.join(app.template_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.template_folder, path)
    else:
        return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
