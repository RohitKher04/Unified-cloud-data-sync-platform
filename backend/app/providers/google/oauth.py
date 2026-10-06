from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

from app.core.config import settings

import requests

GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def _build_flow() -> Flow:
    if not all(
        (
            settings.google_client_id,
            settings.google_client_secret,
            settings.google_redirect_uri,
        )
    ):
        raise RuntimeError("Google OAuth settings are incomplete.")

    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }

    return Flow.from_client_config(
        client_config,
        scopes=[GMAIL_READ_SCOPE],
        redirect_uri=settings.google_redirect_uri,
    )


def create_authorization_url(state: str) -> tuple[str, str]:
    flow = _build_flow()

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    if not flow.code_verifier:
        raise RuntimeError("Google OAuth did not generate a PKCE code verifier.")
    return authorization_url, flow.code_verifier


def exchange_authorization_code(
    code: str,
    *,
    code_verifier: str,
) -> Credentials:
    flow = _build_flow()
    flow.code_verifier = code_verifier
    flow.fetch_token(code=code)
    return flow.credentials

def refresh_access_token(refresh_token: str) -> Credentials:
    if not settings.google_client_id or not settings.google_client_secret:
        raise RuntimeError("Google OAuth client settings are incomplete.")

    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=[GMAIL_READ_SCOPE],
    )

    credentials.refresh(Request())
    return credentials

def revoke_google_token(token: str) -> None:
    response = requests.post(
        "https://oauth2.googleapis.com/revoke",
        data={"token": token},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )

    # Google may report that an already expired or revoked token is invalid.
    # In that case, access has already been revoked.
    if response.status_code == 400:
        try:
            error = response.json().get("error")
        except ValueError:
            error = None

        if error == "invalid_token":
            return

    response.raise_for_status()