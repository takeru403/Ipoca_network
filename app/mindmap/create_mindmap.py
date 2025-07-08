# backend/mindmap/create_mindmap.py

import os
import openai
import ast
import re
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from app.config import Config
import json
from google.auth.exceptions import RefreshError

SCOPES = ["https://www.googleapis.com/auth/presentations.readonly"]
PRESENTATION_ID = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds"

CACHE_PATH = "app/mindmap/mindmap_cache.json"

def load_mindmap_cache():
    try:
        if os.path.exists(CACHE_PATH):
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        # キャッシュがなければ自動生成
        slide_texts = get_slide_texts()
        if not slide_texts:
            mindmap = {"title": "マインドマップ", "children": []}
        else:
            mindmap = build_mindmap_json_with_openai(slide_texts)
        save_mindmap_cache(mindmap)
        return mindmap
    except RuntimeError as e:
        # トークン切れ等のエラーを明示的に返す
        return {"error": str(e)}

def save_mindmap_cache(mindmap_json):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(mindmap_json, f, ensure_ascii=False, indent=2)

def get_slide_title_and_texts():
    creds = None
    if os.path.exists("app/token.json"):
        creds = Credentials.from_authorized_user_file("app/token.json", SCOPES)
    try:
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file("app/credentials.json", SCOPES)
                creds = flow.run_local_server(port=0)
            with open("app/token.json", "w") as f:
                f.write(creds.to_json())
    except RefreshError:
        raise RuntimeError("Google認証トークンが期限切れまたは無効です。再認証が必要です。'app/token.json' を削除して再度アクセスしてください。")

    service = build("slides", "v1", credentials=creds)
    presentation = service.presentations().get(presentationId=PRESENTATION_ID).execute()
    title = presentation.get("title", "マインドマップ")
    slide_texts = []
    for slide in presentation.get("slides", []):
        parts = []
        for elem in slide.get("pageElements", []):
            txt = elem.get("shape", {}).get("text", {}).get("textElements", [])
            for t in txt:
                run = t.get("textRun")
                if run:
                    parts.append(run.get("content", ""))
        joined = "".join(parts).strip()
        if joined:
            slide_texts.append(joined)
    return title, slide_texts

def build_mindmap_json_with_openai(slide_texts, slide_title="マインドマップ"):
    openai.api_key = Config.OPENAI_API_KEY

    slide_text_list = "\n".join([f"{i+1}. {text}" for i, text in enumerate(slide_texts)])
    prompt = (
        "以下はGoogleスライドの各スライド本文です。\n"
        f"親ノードのタイトルは必ずスライド全体のタイトル（例: '{slide_title}'）にしてください。\n"
        "内容を要約し、必ず1つの親ノード（タイトル）で全体をラップし、その下に要点だけをchildrenとして並べてください。\n"
        "childrenは最大3つ程度、階層は1段階または2段階までのシンプルな構造にしてください。\n"
        "childrenが1つだけでも必ず親ノードでラップしてください。\n"
        "必ず標準JSON（ダブルクォートのみ、シングルクォートやコメント禁止、末尾カンマ禁止）で出力してください。\n"
        "出力は1つのJSONオブジェクトのみ、余計な説明やテキストは不要です。\n"
        "\n# スライド一覧\n"
        f"{slide_text_list}\n\n"
        f"# 出力例\n"
        f"{{\n  \"title\": \"{slide_title}\",\n  \"children\": [\n    {{\"title\": \"要点1\"}},\n    {{\"title\": \"要点2\"}},\n    {{\"title\": \"要点3\"}}\n  ]\n}}\n"
    )
    completion = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
    )

    content = completion.choices[0].message.content
    m = None
    if content:
        m = re.search(r"\{(?:[^{}]|(?R))*\}", content, flags=re.DOTALL)
    if m:
        text = m.group(0)
    else:
        text = content if content else ""
    try:
        import json
        result = json.loads(text if text is not None else "")
        # 必ず親ノードでラップし、タイトルをGoogleスライドのタイトルに統一
        if isinstance(result, list):
            return {"title": slide_title, "children": result}
        if (isinstance(result, dict) and "children" in result and isinstance(result["children"], list)):
            result["title"] = slide_title
            return result
        return {"title": slide_title, "children": [result]}
    except Exception as e:
        preview = text[:500] if text else ""
        return {"error": f"OpenAI出力のパースに失敗しました: {e}\n出力内容: {preview}..."}

def main():
    slide_title, slide_texts = get_slide_title_and_texts()
    if not slide_texts:
        mindmap = {"title": slide_title, "children": []}
        save_mindmap_cache(mindmap)
        return mindmap
    mindmap_json = build_mindmap_json_with_openai(slide_texts, slide_title)
    save_mindmap_cache(mindmap_json)
    return mindmap_json

if __name__ == "__main__":
    import json
    print(json.dumps(main(), ensure_ascii=False, indent=2))
