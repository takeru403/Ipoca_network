# backend/mindmap/create_mindmap.py

import os
import openai
import ast
import re
from app.config import Config
import json

CACHE_PATH = "app/mindmap/mindmap_cache.json"

def load_mindmap_cache():
    try:
        if os.path.exists(CACHE_PATH):
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        # キャッシュがなければデフォルトのマインドマップ
        mindmap = {"title": "販促アイディア", "children": []}
        save_mindmap_cache(mindmap)
        return mindmap
    except Exception as e:
        return {"error": str(e)}

def save_mindmap_cache(mindmap_json):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(mindmap_json, f, ensure_ascii=False, indent=2)

def build_mindmap_from_ai_idea(ai_idea, title="販促アイディア"):
    """AIアイディアからマインドマップを生成"""
    openai.api_key = Config.OPENAI_API_KEY

    prompt = (
        f"以下の販促アイディアを分析し、マインドマップ形式で構造化してください。\n"
        f"親ノードのタイトルは必ず「{title}」にしてください。\n"
        f"アイディアの要点を3-5個の子ノードに整理し、各子ノードは簡潔なタイトル（10文字以内）にしてください。\n"
        f"必ず標準JSON（ダブルクォートのみ、シングルクォートやコメント禁止、末尾カンマ禁止）で出力してください。\n"
        f"出力は1つのJSONオブジェクトのみ、余計な説明やテキストは不要です。\n"
        f"\n# AIアイディア\n"
        f"{ai_idea}\n\n"
        f"# 出力例\n"
        f"{{\n"
        f"  \"title\": \"{title}\",\n"
        f"  \"children\": [\n"
        f"    {{\"title\": \"要点1\"}},\n        {{\"title\": \"要点2\"}},\n        {{\"title\": \"要点3\"}}\n"
        f"  ]\n"
        f"}}\n"
    )

    try:
        completion = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1024,
        )

        content = completion.choices[0].message.content
        print("=== OpenAI 返答")
        print(content)
        m = None
        if content:
            m = re.search(r"\{(?:[^{}]|(?R))*\}", content, flags=re.DOTALL)
        if m:
            text = m.group(0)
        else:
            text = content if content else ""

        print("=== JSON 抽出 ===")
        print(text)

        result = json.loads(text if text is not None else "")

        print("=== パース結果 ===")
        print(result)
        # 必ず親ノードでラップし、タイトルを統一
        if isinstance(result, list):
            return {"title": title, "children": result}
        if (isinstance(result, dict) and "children" in result and isinstance(result["children"], list)):
            # childrenが空配列の場合も空配列のまま返す
            result["title"] = title
            return result
        # それ以外は空children
        return {"title": title, "children": []}

    except Exception as e:
        # 例外時も必ず空childrenの親ノードを返す
        return {"title": title, "children": []}

def generate_mindmap_from_idea(ai_idea, title="販促アイディア"):
    """AIアイディアからマインドマップを生成してキャッシュに保存"""
    if not ai_idea:
        mindmap = {"title": title, "children": []}
    else:
        mindmap = build_mindmap_from_ai_idea(ai_idea, title)

    save_mindmap_cache(mindmap)
    return mindmap

def main():
    """デフォルトのマインドマップを生成（互換性のため）"""
    mindmap = {"title": "販促アイディア", "children": []}
    save_mindmap_cache(mindmap)
    return mindmap

if __name__ == "__main__":
    import json
    print(json.dumps(main(), ensure_ascii=False, indent=2))
