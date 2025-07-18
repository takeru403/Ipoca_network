print("=== Starting app.py ===")

from flask import Flask

# 最小限のFlaskアプリを作成
app = Flask(__name__)
app.config['SECRET_KEY'] = 'simple-key'

@app.route('/')
def hello():
    return "Simple Flask App - Working!"

@app.route('/health')
def health():
    return {"status": "healthy", "message": "Lambda is working"}

print("=== Flask app created successfully ===")
print(f"App: {app}")
print(f"Routes: {[str(rule) for rule in app.url_map.iter_rules()]}")
