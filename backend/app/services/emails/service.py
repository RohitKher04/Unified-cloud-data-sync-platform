from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.emails import email_repo
from app.schemas.email import (
    EmailDetail,
    EmailListItem,
    EmailListResponse,
    EmailUpdate,
)


class EmailService:
    def list_emails_for_user(
        self,
        db: Session,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        is_read: bool | None = None,
        is_starred: bool | None = None,
    ) -> EmailListResponse:
        items, total = email_repo.list_for_user(
            db,
            user_id=user_id,
            limit=limit,
            offset=offset,
            q=q,
            is_read=is_read,
            is_starred=is_starred,
        )
        next_cursor = str(offset + limit) if (offset + limit) < total else None
        return EmailListResponse(
            items=[EmailListItem.model_validate(item) for item in items],
            total=total,
            next_cursor=next_cursor,
        )

    def get_email_for_user(
        self,
        db: Session,
        *,
        email_id: int,
        user_id: int,
    ) -> EmailDetail:
        email = email_repo.get_by_id_for_user(
            db,
            email_id=email_id,
            user_id=user_id,
        )
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found.",
            )
        return EmailDetail.model_validate(email)

    def update_email_for_user(
        self,
        db: Session,
        *,
        email_id: int,
        user_id: int,
        update_data: EmailUpdate,
    ) -> EmailDetail:
        email = email_repo.get_by_id_for_user(
            db,
            email_id=email_id,
            user_id=user_id,
        )
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found.",
            )

        updated = email_repo.update_flags(
            db,
            email=email,
            is_read=update_data.is_read,
            is_starred=update_data.is_starred,
        )
        db.commit()
        db.refresh(updated)
        return EmailDetail.model_validate(updated)


email_service = EmailService()
