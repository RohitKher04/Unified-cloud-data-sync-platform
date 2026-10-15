from collections.abc import Iterator
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.integrations import Integration
from app.providers.base import (
    IntegrationProvider,
    ProviderSyncResult,
    SyncContext,
)
from app.providers.google.gmail.client import GmailClient
from app.providers.google.gmail.mapper import map_gmail_message
from app.services.integrations.google_oauth import google_oauth_service


class GoogleGmailProvider(IntegrationProvider):
    provider = "google"
    integration_type = "gmail"

    def get_authorization_url(
        self,
        db: Session,
        *,
        user_id: int,
    ) -> str:
        return google_oauth_service.begin_connection(db, user_id)

    def complete_authentication(
        self,
        db: Session,
        *,
        code: str,
        state: str,
    ) -> Integration:
        return google_oauth_service.complete_connection(
            db,
            code=code,
            state=state,
        )

    def refresh_credentials(
        self,
        db: Session,
        *,
        integration_id: int,
    ) -> Any:
        return google_oauth_service.get_valid_credentials(
            db,
            integration_id,
        )

    def sync(self, context: SyncContext) -> ProviderSyncResult:
        if context.cursor is not None and context.cursor.cursor_value:
            raise ValueError(
                "Incremental Gmail sync not supported yet."
            )

        client = GmailClient(context.credentials)

        try:
            return self._initial_sync(client, context.integration)
        except Exception:
            client.close()
            raise

    def disconnect(
        self,
        db: Session,
        *,
        user_id: int,
        integration_id: int,
    ) -> None:
        google_oauth_service.disconnect_google(
            db,
            user_id=user_id,
            integration_id=integration_id,
        )

    def _initial_sync(
        self,
        client: GmailClient,
        integration: Integration,
    ) -> ProviderSyncResult:
        profile = client.get_profile()
        history_id = profile.get("historyId")

        if not history_id:
            raise RuntimeError("Gmail did not return a history ID.")

        records = self._iter_all_messages(client, integration)

        return ProviderSyncResult(
            records=self._close_when_finished(client, records),
            cursor_value=str(history_id),
        )


    def _iter_all_messages(
        self,
        client: GmailClient,
        integration: Integration,
        max_messages: int = 100,
    ) -> Iterator[dict[str, Any]]:
        page_token: str | None = None
        count = 0

        while True:
            page = client.list_messages(
                page_token=page_token,
                max_results=min(max_messages, 100),
            )

            for message_stub in page.get("messages", []):
                message_id = message_stub.get("id")
                if not message_id:
                    continue

                message = client.get_message(str(message_id))
                yield map_gmail_message(
                    message,
                    user_id=integration.user_id,
                    integration_id=integration.id,
                )

                count += 1
                if count >= max_messages:
                    return

            page_token = page.get("nextPageToken")
            if not page_token:
                break


    @staticmethod
    def _close_when_finished(
        client: GmailClient,
        records: Iterator[dict[str, Any]],
    ) -> Iterator[dict[str, Any]]:
        try:
            yield from records
        finally:
            client.close()
