from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.user_sessions import UserSession


class UserSessionRepository:
    def create(
        self,
        db: Session,
        user_id: int,
        refresh_token_hash: str,
        expires_at: datetime,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> UserSession:
        session = UserSession(
            user_id=user_id,
            refresh_token_hash=refresh_token_hash,
            expires_at=expires_at,
            is_revoked=False,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_active_by_token_hash(
        self, db: Session, token_hash: str
    ) -> UserSession | None:
        now = datetime.now(timezone.utc)
        stmt = (
            select(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .where(UserSession.is_revoked == False)
            .where(UserSession.expires_at > now)
        )
        return db.scalars(stmt).first()

    def revoke(self, db: Session, session: UserSession) -> None:
        session.is_revoked = True
        db.commit()


# Singleton instance for easy import in services
user_session_repo = UserSessionRepository()