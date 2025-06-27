import os
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv("../.env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate

import pandas as pd
import openai

def generate_narration_text(df: pd.DataFrame) -> str:
    narration = []
    narration.append(f"データには{len(df)}件のレコードが含まれています。")
    for col in df.select_dtypes(include='number').columns:
        narration.append(
            f"{col}の平均値は{df[col].mean():.2f}、最大値は{df[col].max():.2f}、最小値は{df[col].min():.2f}です。"
        )
    return " ".join(narration)

def create_narration_audio(text: str, filename="fact_narration.mp3"):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    with open(filename, "wb") as f:
        f.write(response.content)
    return filename

PROMPT_TEMPLATE = """
あなたはデータ分析のナレーターです。
与えられたデータフレームの内容を、淡々と事実のみを述べる形で日本語でナレーションしてください。
平均値・最大値・最小値だけでなく、分布の偏り、外れ値の有無、特徴的な傾向、カテゴリごとの違いなど、データから読み取れる当たり前の事象を簡潔に述べてください。
主観や推測は入れず、客観的な事実のみを述べてください。

# データ概要
{data_overview}

# ナレーション
"""

def generate_narration_with_llm(df: pd.DataFrame) -> str:
    data_overview = f"{df.head(3).to_string(index=False)}\n\n{df.describe(include='all').to_string()}"
    prompt = PROMPT_TEMPLATE.format(data_overview=data_overview)
    llm = ChatOpenAI(
        openai_api_key=OPENAI_API_KEY,
        model_name="gpt-4o",
        temperature=0.2
    )
    narration = llm.predict(prompt)
    return narration
