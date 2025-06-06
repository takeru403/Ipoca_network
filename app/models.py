from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()#DBの作成


class User(db.Model): #ユーザーモデル
  id = db.Column(db.Integer, primary_key=True)#主キー
  usernamename = db.Column(db.String(80), unique=True, nullable=False)
  password = db.Column(db.String(120), nullable=False)
  created_at = db.Column(db.DateTime, server_default=db.func.now())#作成日時


class SearchLog(db.Model): #検索履歴
  id = db.Column(db.Integer, primary_key=True) #主キー
  user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
  query_text = db.Column(db.String(255))
  result_summary = db.Column(db.Text)
  timestamp = db.Column(db.DateTime, server_default=db.func.now())#作成日時
