from flask import Blueprint, request, jsonify, session
from app.decorators import login_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    if data.get("username") == "ipoca_test" and data.get("password") == "ipoca_test":
        session["user"] = "ipoca_test"
        session.permanent = True
        return jsonify({"message": "logged_in"})
    return jsonify({"error": "invalid_credentials"}), 401

@auth_bp.post("/logout")
@login_required
def logout():
    session.clear()
    return jsonify({"message": "logged_out"})
