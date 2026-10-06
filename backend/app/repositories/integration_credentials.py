from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.integration_credentials import IntegrationCredential


class IntegrationCredentialRepository:
    def get_by_integration_id(
        self,
        db: Session,
        integration_id: int,
    ) -> IntegrationCredential | None:
        statement = select(IntegrationCredential).where(
            IntegrationCredential.integration_id == integration_id
        )
        return db.scalars(statement).first()

    def create(
        self,
        db: Session,
        *,
        integration_id: int,
        encrypted_access_token: str,
        encrypted_refresh_token: str | None,
        expires_at: datetime | None,
        scopes: list[str],
    ) -> IntegrationCredential:
        credential = IntegrationCredential(
            integration_id=integration_id,
            encrypted_access_token=encrypted_access_token,
            encrypted_refresh_token=encrypted_refresh_token,
            expires_at=expires_at,
            scopes=scopes,
        )
        db.add(credential)
        db.flush()
        return credential

    def update_after_refresh(
        self,
        db: Session,
        credential: IntegrationCredential,
        *,
        encrypted_access_token: str,
        expires_at: datetime | None,
        encrypted_refresh_token: str | None = None,
    ) -> IntegrationCredential:
        credential.encrypted_access_token = encrypted_access_token
        credential.expires_at = expires_at

        # Keep the existing refresh token unless Google provides a replacement.
        if encrypted_refresh_token is not None:
            credential.encrypted_refresh_token = encrypted_refresh_token

        db.flush()
        return credential


integration_credential_repo = IntegrationCredentialRepository()