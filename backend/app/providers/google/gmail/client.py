from typing import Any

import httplib2
from google.auth.credentials import Credentials
from google_auth_httplib2 import AuthorizedHttp
from googleapiclient.discovery import build


class GmailClient:
    """Small client for listing Gmail messages and retrieving their details."""

    def __init__(self, credentials: Credentials) -> None:
        http = httplib2.Http(timeout=10)
        authorized_http = AuthorizedHttp(credentials, http=http)

        self._service = build(
            "gmail",
            "v1",
            http=authorized_http,
            cache_discovery=False,
        )

    def list_messages(
        self,
        *,
        page_token: str | None = None,
        max_results: int = 100,
        query: str | None = None,
    ) -> dict[str, Any]:
        """Return one page of Gmail message IDs and the next-page token."""

        if not 1 <= max_results <= 500:
            raise ValueError("max_results must be between 1 and 500.")

        params: dict[str, Any] = {
            "userId": "me",
            "maxResults": max_results,
        }

        if page_token:
            params["pageToken"] = page_token

        if query:
            params["q"] = query

        return self._service.users().messages().list(**params).execute()

    def get_message(self, message_id: str) -> dict[str, Any]:
        """Return one full Gmail message resource."""

        return (
            self._service.users()
            .messages()
            .get(
                userId="me",
                id=message_id,
                format="full",
            )
            .execute()
        )

    def get_profile(self) -> dict[str, Any]:
        """Return Gmail account metadata, including its current history ID."""

        return self._service.users().getProfile(userId="me").execute()

    def list_history(
        self,
        *,
        start_history_id: str,
        page_token: str | None = None,
        max_results: int = 100,
        history_types: list[str] | None = None,
    ) -> dict[str, Any]:
        """Return one page of Gmail mailbox changes after a history ID."""

        if not 1 <= max_results <= 500:
            raise ValueError("max_results must be between 1 and 500.")

        params: dict[str, Any] = {
            "userId": "me",
            "startHistoryId": start_history_id,
            "maxResults": max_results,
        }

        if page_token:
            params["pageToken"] = page_token

        if history_types:
            params["historyTypes"] = history_types

        return self._service.users().history().list(**params).execute()

    def close(self) -> None:
        """Close the underlying Google API HTTP connection."""

        self._service.close()