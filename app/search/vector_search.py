# # backend/search/vector_search.py
# import os, tempfile
# from googleapiclient.discovery import build
# from google.oauth2.credentials import Credentials
# from google_auth_oauthlib.flow import InstalledAppFlow
# from google.auth.transport.requests import Request
# from langchain_community.vectorstores import Chroma
# from langchain.schema import Document
# from langchain_openai import OpenAIEmbeddings
# from chromadb.config import Settings
# import chromadb
# from app.config import Config

# SCOPES = ["https://www.googleapis.com/auth/presentations.readonly"]
# PRESENTATION_ID = "1xW8Lze5bfwUzNd9ZqputgTFyQJdoKK3f3I7esGACAds"
# TMP_DIR = os.path.join(tempfile.gettempdir(), "chroma_slides")
# os.makedirs(TMP_DIR, exist_ok=True)

# def perform_search(query):
#     creds = None
#     if os.path.exists("app/token.json"):
#         creds = Credentials.from_authorized_user_file("app/token.json", SCOPES)
#     if not creds or not creds.valid:
#         if creds and creds.expired and creds.refresh_token:
#             creds.refresh(Request())
#         else:
#             flow = InstalledAppFlow.from_client_secrets_file("app/credentials.json", SCOPES)
#             creds = flow.run_local_server(port=0)
#         with open("app/token.json", "w") as f:
#             f.write(creds.to_json())

#     service = build("slides", "v1", credentials=creds)
#     presentation = service.presentations().get(presentationId=PRESENTATION_ID).execute()

#     slide_texts = []
#     for slide in presentation.get("slides", []):
#         parts = []
#         for elem in slide.get("pageElements", []):
#             txt = elem.get("shape", {}).get("text", {}).get("textElements", [])
#             for t in txt:
#                 run = t.get("textRun")
#                 if run:
#                     parts.append(run.get("content", ""))
#         slide_texts.append("".join(parts))

#     docs = [Document(page_content=slide_texts[i], metadata={"idx": i}) for i in range(len(slide_texts))]
#     client = chromadb.PersistentClient(path=TMP_DIR)
#     store = Chroma.from_documents(
#         docs,
#         OpenAIEmbeddings(api_key=Config.OPENAI_API_KEY),
#         collection_name="slides",
#         client=client,
#         client_settings=Settings(
#             chroma_db_impl="duckdb+parquet",
#             persist_directory=TMP_DIR,
#         ),
#     )
#     results = store.similarity_search_with_score(query, k=3)
#     return [
#         {"slide_index": doc.metadata["idx"] + 1, "content": doc.page_content, "score": score}
#         for doc, score in results
#     ]
