import logging
import time
from collections.abc import Iterator
from typing import Any

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.config import settings
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
        client = GmailClient(context.credentials)

        try:
            # If a cursor (historyId) already exists, perform incremental sync
            if context.cursor is not None and context.cursor.cursor_value:
                return self._incremental_sync(
                    client=client,
                    integration=context.integration,
                    start_history_id=context.cursor.cursor_value,
                )

            # Otherwise, perform the full initial sync
            return self._initial_sync(client, context.integration)
        except Exception:
            client.close()
            raise

    def _incremental_sync(
        self,
        client: GmailClient,
        integration: Integration,
        start_history_id: str,
    ) -> ProviderSyncResult:
        """Fetch changes since start_history_id using Gmail History API."""
        page_token: str | None = None
        updated_message_ids: set[str] = set()
        deleted_message_ids: set[str] = set()
        latest_history_id = start_history_id

        try:
            while True:
                response = client.list_history(
                    start_history_id=start_history_id,
                    page_token=page_token,
                    max_results=100,
                )

                if "historyId" in response:
                    latest_history_id = str(response["historyId"])

                for history_record in response.get("history", []):
                    #new messages
                    for added in history_record.get("messagesAdded", []):
                        msg_id = added.get("message", {}).get("id")
                        if msg_id:
                            updated_message_ids.add(msg_id)

                    #label changes (read/unread, starred, inbox)
                    for lbl_added in history_record.get("labelsAdded", []):
                        msg_id = lbl_added.get("message", {}).get("id")
                        if msg_id:
                            updated_message_ids.add(msg_id)

                    for lbl_removed in history_record.get("labelsRemoved", []):
                        msg_id = lbl_removed.get("message", {}).get("id")
                        if msg_id:
                            updated_message_ids.add(msg_id)

                    #deleted messages
                    for deleted in history_record.get("messagesDeleted", []):
                        msg_id = deleted.get("message", {}).get("id")
                        if msg_id:
                            deleted_message_ids.add(msg_id)

                page_token = response.get("nextPageToken")
                if not page_token:
                    break

        except HttpError as exc:
            # If historyId expired (HTTP 404), Gmail cannot provide delta -> fallback to initial sync
            if exc.resp.status == 404:
                return self._initial_sync(client, integration)
            raise

        # remove deleted messages from update list if any overlap
        updated_message_ids.difference_update(deleted_message_ids)

        def iter_updated_records() -> Iterator[dict[str, Any]]:
            for msg_id in updated_message_ids:
                try:
                    raw_msg = self._get_message_with_retry(client, msg_id)
                    yield map_gmail_message(
                        raw_msg,
                        user_id=integration.user_id,
                        integration_id=integration.id,
                    )
                except HttpError as err:
                    # Message may have been permanently deleted right after event
                    if err.resp.status == 404:
                        deleted_message_ids.add(msg_id)
                        continue
                    raise

        records = self._close_when_finished(client, iter_updated_records())

        return ProviderSyncResult(
            records=records,
            cursor_value=latest_history_id,
            deleted_external_ids=deleted_message_ids,
        )

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

        records = self._iter_all_messages(
            client,
            integration,
            max_messages=settings.gmail_initial_sync_max_messages,
        )

        return ProviderSyncResult(
            records=self._close_when_finished(client, records),
            cursor_value=str(history_id),
        )


    def _iter_all_messages(
        self,
        client: GmailClient,
        integration: Integration,
        max_messages: int | None = 0,
    ) -> Iterator[dict[str, Any]]:
        page_token: str | None = None
        count = 0
        has_limit = max_messages is not None and max_messages > 0

        while True:
            page = client.list_messages(
                page_token=page_token,
                max_results=min(max_messages - count, 100) if has_limit else 100,
            )

            for message_stub in page.get("messages", []):
                message_id = message_stub.get("id")
                if not message_id:
                    continue

                message = self._get_message_with_retry(client, str(message_id))
                yield map_gmail_message(
                    message,
                    user_id=integration.user_id,
                    integration_id=integration.id,
                )

                count += 1
                if has_limit and count >= max_messages:
                    return

            page_token = page.get("nextPageToken")
            if not page_token:
                break


    def _get_message_with_retry(
            self,
            client: GmailClient,
            message_id: str,
            max_attempts: int = 5,
        ) -> dict[str, Any]:
            
            backoff_seconds = 15.0
    
            for attempt in range(max_attempts):
                try:
                    time.sleep(0.15)
                    return client.get_message(str(message_id))
                except HttpError as err:
                    is_rate_limit = (
                        err.resp.status in (403, 429)
                        and "rateLimitExceeded" in str(err)
                    )
                    if is_rate_limit and attempt < max_attempts - 1:
                        logger.warning(
                            "Google rate limit reached on message %s. Waiting %.0fs for quota reset (attempt %d/%d)...",
                            message_id,
                            backoff_seconds,
                            attempt + 1,
                            max_attempts,
                        )
                        time.sleep(backoff_seconds)
                        backoff_seconds *= 2.0  # 15s, 30s, 60s
                        continue
                    raise
    
    @staticmethod
    def _close_when_finished(
        client: GmailClient,
        records: Iterator[dict[str, Any]],
    ) -> Iterator[dict[str, Any]]:
        try:
            yield from records
        finally:
            client.close()
