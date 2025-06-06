#from datetime import datetime
#import os
#from app.mindmap.create_mindmap import get_slide_texts
#
#VAULT_PATH = os.path.expanduser("~/Documents/Obsidian Vault/日報")
#DATE = datetime.now().strftime("%Y-%m-%d")
#TITLE = f"{DATE} の日報"
#FILENAME = f"{DATE}-daily-note.md"
#
#def generate_note():
#    # スライドのテキストを取得
#    slide_texts = get_slide_texts()
#
#    # スライドの内容を箇条書きに変換
#    slide_content = "\n".join([f"- {text}" for text in slide_texts]) if slide_texts else "- (スライドの内容なし)"
#
#    content = f"""# {TITLE}
#
### 今日やったこと
#-
#
### 明日やること
#-
#
### メモ・ふりかえり
#-
#
### 本日のスライド内容
#{slide_content}
#"""
#
#    with open(os.path.join(VAULT_PATH, FILENAME), "w") as f:
#        f.write(content)
#
#    print(f"✅ ノート生成完了: {FILENAME}")

if __name__ == "__main__":
    import sys
    import os
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from app.mindmap.create_mindmap import get_slide_texts

    slide_texts = get_slide_texts()
    print(slide_texts)

