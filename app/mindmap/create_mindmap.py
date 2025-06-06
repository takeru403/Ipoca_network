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

SCOPES = ["https://www.googleapis.com/auth/presentations.readonly"]
PRESENTATION_ID = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds"

def get_slide_texts():
    creds = None
    if os.path.exists("app/token.json"):
        creds = Credentials.from_authorized_user_file("app/token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("app/credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("app/token.json", "w") as f:
            f.write(creds.to_json())

    service = build("slides", "v1", credentials=creds)
    presentation = service.presentations().get(presentationId=PRESENTATION_ID).execute()
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
    return slide_texts

def build_mindmap_json_with_openai(slide_texts):
    # GPT-4などを使って階層構造を推定
    openai.api_key = Config.OPENAI_API_KEY

    slide_text_list = "\n".join([f"{i+1}. {text}" for i, text in enumerate(slide_texts)])
    prompt = (
        "以下はGoogleスライドの各スライド本文です。\n"
        "タイトルや内容をもとに、内容に応じたツリー構造（親子関係を持つ階層的なマインドマップ）として\n"
        "必ず **標準JSON（ダブルクォートのみ、シングルクォートやコメントは禁止、末尾カンマ禁止）** で出力してください。\n"
        "コードブロックや'''等も不要です。\n\n"
        "# スライド一覧\n"
        f"{slide_text_list}\n\n"
        "# 出力例\n"
        "{\n"
        '  "title": "販促事例研究",\n'
        '  "children": [\n'
        '    {\n'
        '      "title": "消費者理解",\n'
        '      "children": [\n'
        '        {"title": "MEMO"},\n'
        '        {"title": "消費者目線での購買理由・インサイト"}\n'
        '      ]\n'
        '    },\n'
        '    {\n'
        '      "title": "ラベル",\n'
        '      "children": [\n'
        '        {"title": "ツール活用(4)"},\n'
        '        {"title": "レイアウト活用(1)"}\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        '}\n'
    )

    completion = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=16384,
    )

    # 結果から最初に見つかった { から } までを抽出
    m = re.search(r"\{.*\}", completion.choices[0].message.content, flags=re.DOTALL)
    if m:
        text = m.group(0)
    else:
        text = completion.choices[0].message.content
    try:
        import json
        return json.loads(text)
    except Exception:
        # fallback: Python辞書風でも通るように
        return ast.literal_eval(text)

def main():
    slide_texts = get_slide_texts()
    if not slide_texts:
        return {"title": "マインドマップ", "children": []}
    mindmap_json = build_mindmap_json_with_openai(slide_texts)
    return mindmap_json

if __name__ == "__main__":
    import json
    print(json.dumps(main(), ensure_ascii=False, indent=2))
