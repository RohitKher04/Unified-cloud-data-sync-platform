from typing import Any

from sqlalchemy import delete, func, literal_column, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models.emails import Email


class EmailRepository:
    def upsert(
        self,
        db: Session,
        email_data: dict[str, Any],
    ) -> tuple[Email, bool]:
        """Insert an email or update it if this Gmail message already exists."""

        statement = insert(Email).values(**email_data)

        fields_to_update = (
            "thread_id",
            "subject",
            "sender",
            "recipients",
            "cc",
            "bcc",
            "snippet",
            "body_text",
            "body_html",
            "received_at",
            "is_read",
            "is_starred",
            "labels",
        )

        update_values = {
            field: getattr(statement.excluded, field)
            for field in fields_to_update
        }
        update_values["updated_at"] = func.now()

        statement = (
            statement.on_conflict_do_update(
                constraint="uq_emails_integration_external_id",
                set_=update_values,
            )
            .returning(
                Email,
                literal_column("xmax = 0").label("inserted"),
            )
        )
        email, inserted = db.execute(statement).one()

        return email, bool(inserted)

    def delete_by_external_ids(
        self,
        db: Session,
        *,
        integration_id: int,
        external_ids: list[str],
    ) -> int:
        """Delete messages by Gmail ID, scoped to their integration."""

        ids = tuple(set(external_ids))
        if not ids:
            return 0

        statement = delete(Email).where(
            Email.integration_id == integration_id,
            Email.external_id.in_(ids),
        )
        result = db.execute(statement)
        return result.rowcount or 0

    def get_by_id_for_user(
        self,
        db: Session,
        *,
        email_id: int,
        user_id: int,
    ) -> Email | None:
        statement = select(Email).where(
            Email.id == email_id,
            Email.user_id == user_id,
        )
        return db.scalars(statement).first()

    def list_for_user(
        self,
        db: Session,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        is_read: bool | None = None,
        is_starred: bool | None = None,
    ) -> tuple[list[Email], int]:
        query = select(Email).where(Email.user_id == user_id)

        if is_read is not None:
            query = query.where(Email.is_read == is_read)
        if is_starred is not None:
            query = query.where(Email.is_starred == is_starred)
        if q:
            search = f"%{q}%"
            query = query.where(
                or_(
                    Email.subject.ilike(search),
                    Email.snippet.ilike(search),
                    Email.sender.ilike(search),
                )
            )

        total_stmt = select(func.count()).select_from(query.subquery())
        total = db.scalar(total_stmt) or 0

        stmt = (
            query.order_by(Email.received_at.desc().nullslast())
            .offset(offset)
            .limit(limit)
        )
        items = list(db.scalars(stmt).all())
        return items, total

    def update_flags(
        self,
        db: Session,
        *,
        email: Email,
        is_read: bool | None = None,
        is_starred: bool | None = None,
    ) -> Email:
        if is_read is not None:
            email.is_read = is_read
        if is_starred is not None:
            email.is_starred = is_starred
        db.flush()
        return email


email_repo = EmailRepository()
