from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.repositories.users import user_repo
from app.repositories.user_sessions import user_session_repo
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate


class AuthService:
    def register(self, db: Session, user_in: UserCreate) -> TokenResponse:
        existing = user_repo.get_by_email(db, user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

        password_hash = hash_password(user_in.password)
        user = user_repo.create(db, user_in, password_hash)

        return self._issue_tokens(db, user.id)

    def login(self, db: Session, email: str, password: str) -> TokenResponse:
        user = user_repo.get_by_email(db, email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is inactive.",
            )

        return self._issue_tokens(db, user.id)

    def refresh(self, db: Session, refresh_token: str) -> TokenResponse:
        token_hash = hash_token(refresh_token)
        session = user_session_repo.get_active_by_token_hash(db, token_hash)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
            )

        user_id = session.user_id
        user_session_repo.revoke(db, session)

        return self._issue_tokens(db, user_id)

    def logout(self, db: Session, refresh_token: str) -> None:
        token_hash = hash_token(refresh_token)
        session = user_session_repo.get_active_by_token_hash(db, token_hash)
        if session:
            user_session_repo.revoke(db, session)

    def _issue_tokens(self, db: Session, user_id: int) -> TokenResponse:
        from app.core.config import settings

        access_token, _ = create_access_token(user_id)
        refresh_token, refresh_expires_at = create_refresh_token(user_id)

        user_session_repo.create(
            db=db,
            user_id=user_id,
            refresh_token_hash=hash_token(refresh_token),
            expires_at=refresh_expires_at,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
        )


# Singleton instance
auth_service = AuthService()