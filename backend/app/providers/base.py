from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.integrations import Integration
from app.db.models.sync_cursors import SyncCursor


@dataclass(frozen=True)
class SyncContext:
    integration: Integration
    cursor: SyncCursor | None
    credentials: Any


@dataclass(frozen=True)
class ProviderSyncResult:
    # Each record is normalized data that the service can persist.
    records: Iterable[dict[str, Any]]
    cursor_value: str | None
    deleted_external_ids: Iterable[str] = ()


class IntegrationProvider(ABC):
    """Common lifecycle interface implemented by integration adapters."""

    provider: str
    integration_type: str

    @abstractmethod
    def get_authorization_url(
        self,
        db: Session,
        *,
        user_id: int,
    ) -> str:
        raise NotImplementedError

    @abstractmethod
    def complete_authentication(
        self,
        db: Session,
        *,
        code: str,
        state: str,
    ) -> Integration:
        raise NotImplementedError

    @abstractmethod
    def refresh_credentials(
        self,
        db: Session,
        *,
        integration_id: int,
    ) -> Any:
        raise NotImplementedError

    @abstractmethod
    def sync(self, context: SyncContext) -> ProviderSyncResult:
        """Fetch and normalize provider records without persisting them."""
        raise NotImplementedError

    @abstractmethod
    def disconnect(
        self,
        db: Session,
        *,
        user_id: int,
        integration_id: int,
    ) -> None:
        raise NotImplementedError