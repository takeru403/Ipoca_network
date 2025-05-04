from app import create_app

app = create_app()

if __name__ == "__main__": #python run.pyとして実行した場合、モジュール名は __main__になる。
    app.run(debug=True)
