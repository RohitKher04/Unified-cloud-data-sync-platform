from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.db.models.users import User
from app.db.session import get_db
from app.schemas.email import (
    EmailDetail,
    EmailListResponse,
    EmailUpdate,
)
from app.services.emails.service import email_service

router = APIRouter()


@router.get("", response_model=EmailListResponse)
def list_emails(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    is_read: bool | None = Query(default=None),
    is_starred: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailListResponse:
    return email_service.list_emails_for_user(
        db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        q=q,
        is_read=is_read,
        is_starred=is_starred,
    )


@router.get("/{email_id}", response_model=EmailDetail)
def get_email_detail(
    email_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailDetail:
    return email_service.get_email_for_user(
        db,
        email_id=email_id,
        user_id=current_user.id,
    )


@router.patch("/{email_id}", response_model=EmailDetail)
def update_email(
    email_id: int,
    update_data: EmailUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailDetail:
    return email_service.update_email_for_user(
        db,
        email_id=email_id,
        user_id=current_user.id,
        update_data=update_data,
    )
