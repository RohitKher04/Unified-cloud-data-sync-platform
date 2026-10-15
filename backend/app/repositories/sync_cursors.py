from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models.sync_cursors import SyncCursor


class SyncCursorRepository:
    def get(
        self,
        db: Session,
        *,
        integration_id: int,
        resource_type: str,
    ) -> SyncCursor | None:
        statement = select(SyncCursor).where(
            SyncCursor.integration_id == integration_id,
            SyncCursor.resource_type == resource_type,
        )
        return db.scalars(statement).first()

    def upsert(
        self,
        db: Session,
        *,
        integration_id: int,
        provider: str,
        resource_type: str,
        cursor_value: str | None,
        last_successful_sync_at: datetime | None,
    ) -> SyncCursor:
        statement = insert(SyncCursor).values(
            integration_id=integration_id,
            provider=provider,
            resource_type=resource_type,
            cursor_value=cursor_value,
            last_successful_sync_at=last_successful_sync_at,
        )

        statement = (
            statement.on_conflict_do_update(
                constraint="uq_sync_cursors_integration_resource",
                set_={
                    "provider": statement.excluded.provider,
                    "cursor_value": statement.excluded.cursor_value,
                    "last_successful_sync_at":
                        statement.excluded.last_successful_sync_at,
                    "updated_at": func.now(),
                },
            )
            .returning(SyncCursor)
        )

        return db.scalars(statement).one()


sync_cursor_repo = SyncCursorRepository()