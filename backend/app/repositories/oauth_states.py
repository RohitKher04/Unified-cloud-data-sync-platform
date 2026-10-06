from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.oauth_states import OAuthState


class OAuthStateRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: int,
        state_hash: str,
        encrypted_code_verifier: str,
        expires_at: datetime,
    ) -> OAuthState:
        oauth_state = OAuthState(
            user_id=user_id,
            state_hash=state_hash,
            encrypted_code_verifier=encrypted_code_verifier,
            expires_at=expires_at,
        )
        db.add(oauth_state)
        db.commit()
        db.refresh(oauth_state)
        return oauth_state

    def consume_by_hash(
        self,
        db: Session,
        state_hash: str,
    ) -> tuple[int, datetime, str | None] | None:
        statement = (
            select(OAuthState)
            .where(OAuthState.state_hash == state_hash)
            .with_for_update()
        )
        oauth_state = db.scalars(statement).first()

        if oauth_state is None:
            return None

        result = (oauth_state.user_id, oauth_state.expires_at, oauth_state.encrypted_code_verifier)
        db.delete(oauth_state)
        db.commit()

        return result


oauth_state_repo = OAuthStateRepository()