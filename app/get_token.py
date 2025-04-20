from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
SCOPES = ["https://www.googleapis.com/auth/presentations.readonly"]

flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
creds = flow.run_local_server(port=0)
with open("token.json", "w") as f:
    f.write(creds.to_json())
print("✅ token.json written")
