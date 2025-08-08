import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get variables
CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
TENANT_ID = os.getenv("MICROSOFT_TENANT_ID")
FROM_EMAIL = os.getenv("FROM_EMAIL")
TO_EMAIL = FROM_EMAIL  # Send to self for test

# 1. Get access token
def get_access_token():
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
    }

    response = requests.post(url, headers=headers, data=data)
    response.raise_for_status()
    return response.json()["access_token"]

# 2. Send email
def send_email(access_token):
    url = f"https://graph.microsoft.com/v1.0/users/{FROM_EMAIL}/sendMail"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    email_msg = {
        "message": {
            "subject": "🧪 Test Email from Python via Microsoft Graph",
            "body": {
                "contentType": "Text",
                "content": "This is a test email sent using Microsoft Graph API with Python."
            },
            "toRecipients": [
                {"emailAddress": {"address": TO_EMAIL}}
            ]
        }
    }

    response = requests.post(url, headers=headers, json=email_msg)
    response.raise_for_status()
    print("✅ Email sent successfully!")

# Run test
if __name__ == "__main__":
    try:
        token = get_access_token()
        send_email(token)
    except Exception as e:
        print("❌ Error sending email:", e)
