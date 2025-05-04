from functools import wraps
from flask import session, jsonify

def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if session.get("user") != "ipoca_test":
            return jsonify({"error": "login_required"}), 401
        return func(*args, **kwargs)
    return wrapper
