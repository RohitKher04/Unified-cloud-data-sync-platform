from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.db.models.users import User
from app.db.session import get_db
from app.schemas.integration import (
    GoogleConnectResponse,
    IntegrationResponse,
)
from app.services.integrations.google_oauth import google_oauth_service

router = APIRouter()


@router.get(
    "/google/connect",
    response_model=GoogleConnectResponse,
)
def connect_google(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorization_url = google_oauth_service.begin_connection(
        db,
        current_user.id,
    )
    return {"authorization_url": authorization_url}


@router.get(
    "/google/callback",
    response_model=IntegrationResponse,
)
def google_callback(
    state: str,
    code: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authorization was cancelled or denied.",
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return an authorization code.",
        )

    return google_oauth_service.complete_connection(
        db,
        code=code,
        state=state,
    )


@router.get(
    "",
    response_model=list[IntegrationResponse],
)
def list_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return google_oauth_service.list_for_user(
        db,
        current_user.id,
    )

@router.delete(
    "/{integration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def disconnect_google(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    google_oauth_service.disconnect_google(
        db,
        user_id=current_user.id,
        integration_id=integration_id,
    )