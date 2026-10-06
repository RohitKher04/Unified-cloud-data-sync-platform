from typing import Any

import httplib2
from google.auth.credentials import Credentials
from google_auth_httplib2 import AuthorizedHttp
from googleapiclient.discovery import build


def get_gmail_profile(credentials: Credentials) -> dict[str, Any]:
    http = httplib2.Http(timeout=10)
    authorized_http = AuthorizedHttp(credentials, http=http)

    gmail_service = build(
        "gmail",
        "v1",
        http=authorized_http,
        cache_discovery=False,
    )

    try:
        return gmail_service.users().getProfile(userId="me").execute()
    finally:
        gmail_service.close()