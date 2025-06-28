from app import create_app

app = create_app()

if __name__ == "__main__": #python run.pyとして実行した場合、モジュール名は __main__になる。
    app.run(debug=False, host="0.0.0.0", port=5000) #本番環境でdebugをTrueに変更する。
