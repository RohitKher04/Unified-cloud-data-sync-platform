from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from google.oauth2.credentials import Credentials

from app.repositories.oauth_states import oauth_state_repo

from app.core.config import settings
from app.core.encryption import decrypt_token, encrypt_token
from app.db.models.integrations import Integration
from app.providers.google.client import get_gmail_profile
from app.providers.google.oauth import (
    GMAIL_READ_SCOPE,
    create_authorization_url,
    exchange_authorization_code,
    refresh_access_token,
    revoke_google_token,
)
from app.repositories.integration_credentials import (
    integration_credential_repo,
)
from app.repositories.integrations import integration_repo


class GoogleOAuthService:
    def begin_connection(self, db: Session, user_id: int) -> str:
        state = secrets.token_urlsafe(32)

        # Create the URL before saving state, so a configuration error
        # doesn't leave an unused state record in the database.
        authorization_url, code_verifier = create_authorization_url(state)

        state_hash = hashlib.sha256(
            state.encode("utf-8")
        ).hexdigest()

        oauth_state_repo.create(
            db,
            user_id=user_id,
            state_hash=state_hash,
            encrypted_code_verifier=encrypt_token(code_verifier),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )

        return authorization_url

    def complete_connection(
        self,
        db: Session,
        *,
        code: str,
        state: str,
    ) -> Integration:
        state_hash = hashlib.sha256(
            state.encode("utf-8")
        ).hexdigest()


        #consume the state from the database
        saved_state = oauth_state_repo.consume_by_hash(db, state_hash)

        if saved_state is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or already-used OAuth state. Start again.",
            )

        user_id, expires_at, encrypted_code_verifier = saved_state

        if not encrypted_code_verifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth state is missing its verifier. Start the connection again.",
            )

        #decrypt the pkce code verifier
        try:
            code_verifier = decrypt_token(encrypted_code_verifier)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not complete Google authorization.",
            ) from exc

        #check state expriy
        now = datetime.now(timezone.utc)

        if expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth state expired. Start the connection again.",
            )

        #exchange the authorization code for token calls
        try:
            credentials = exchange_authorization_code(
                code,
                code_verifier=code_verifier,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google authorization failed. Start the connection again.",
            ) from exc

        #validate token are present if no access_token or no refresh_token
        if not credentials.token or not credentials.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google did not provide the tokens required for this connection.",
            )

        #fetch the connected gmail profile
        try:
            profile = get_gmail_profile(credentials)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not retrieve the connected Gmail profile.",
            ) from exc

        email = profile.get("emailAddress")
        if not isinstance(email, str) or not email:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google did not return a Gmail address.",
            )

        #check for duplicate connecction calles
        existing = integration_repo.get_by_account(
            db,
            user_id=user_id,
            provider="google",
            integration_type="gmail",
            external_account_id=email,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Gmail account is already connected.",
            )

        token_expiry = credentials.expiry
        if token_expiry and token_expiry.tzinfo is None:
            token_expiry = token_expiry.replace(tzinfo=timezone.utc)

        granted_scopes = getattr(credentials, "granted_scopes", None)
        scopes = list(
            granted_scopes
            or credentials.scopes
            or [GMAIL_READ_SCOPE]
        )


        #Save two rows to the database(in one trasaction)
        try:
            integration = integration_repo.create(
                db,
                user_id=user_id,
                provider="google",
                integration_type="gmail",
                external_account_id=email,
                external_email=email,
            )

            integration_credential_repo.create(
                db,
                integration_id=integration.id,
                encrypted_access_token=encrypt_token(credentials.token),
                encrypted_refresh_token=encrypt_token(
                    credentials.refresh_token
                ),
                expires_at=token_expiry,
                scopes=scopes,
            )

            db.commit()
            db.refresh(integration)

        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Gmail account is already connected.",
            ) from exc

        return integration

    def list_for_user(
        self,
        db: Session,
        user_id: int,
    ) -> list[Integration]:
        return integration_repo.list_for_user(
            db,
            user_id=user_id,
        )

    def refresh_integration_credentials(
        self,
        db: Session,
        integration_id: int,
    ) -> Credentials:
        credential = integration_credential_repo.get_by_integration_id(
            db,
            integration_id,
        )

        if credential is None or not credential.encrypted_refresh_token:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This integration has no refresh token. Reconnect Google.",
            )

        # decrypt the stored refresh token before sending it to google
        try:
            refresh_token = decrypt_token(credential.encrypted_refresh_token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not read the stored Google credentials.",
            ) from exc


        #refresh the access token using the stored refresh token
        try:
            refreshed_credentials = refresh_access_token(refresh_token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google token refresh failed. Reconnect the account if the problem continues.",
            ) from exc

        if not refreshed_credentials.token:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google did not return a new access token.",
            )

        expires_at = refreshed_credentials.expiry
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)


        # Keep the existing refresh token unless Google returns a replacement
        encrypted_refresh_token = None
        if (
            refreshed_credentials.refresh_token
            and refreshed_credentials.refresh_token != refresh_token
        ):
            encrypted_refresh_token = encrypt_token(
                refreshed_credentials.refresh_token
            )

        # save the refreshed credentials 
        try:
            integration_credential_repo.update_after_refresh(
                db,
                credential,
                encrypted_access_token=encrypt_token(
                    refreshed_credentials.token
                ),
                expires_at=expires_at,
                encrypted_refresh_token=encrypted_refresh_token,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise

        return refreshed_credentials

    def get_valid_credentials(
        self,
        db: Session,
        integration_id: int,
    ) -> Credentials:
        credential = integration_credential_repo.get_by_integration_id(
            db,
            integration_id,
        )

        if credential is None or not credential.encrypted_refresh_token:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This integration has no usable credentials. Reconnect Google.",
            )

        try:
            access_token = decrypt_token(credential.encrypted_access_token)
            refresh_token = decrypt_token(credential.encrypted_refresh_token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not read the stored Google credentials.",
            ) from exc

        expires_at = credential.expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        refresh_soon = (
            expires_at is None
            or expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5)
        )

        if refresh_soon:
            return self.refresh_integration_credentials(db, integration_id)

        return Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scopes=credential.scopes,
            expiry=expires_at,
        )
    

    def disconnect_google(
        self,
        db: Session,
        *,
        user_id: int,
        integration_id: int,
    ) -> None:
        integration = integration_repo.get_by_id_for_user(
            db,
            integration_id=integration_id,
            user_id=user_id,
        )

        if integration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found.",
            )

        if integration.provider != "google" or integration.integration_type != "gmail":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This disconnect operation supports Google Gmail integrations only.",
            )

        credential = integration_credential_repo.get_by_integration_id(
            db,
            integration.id,
        )

        if credential is not None:
            encrypted_token = (
                credential.encrypted_refresh_token
                or credential.encrypted_access_token
            )

            try:
                token = decrypt_token(encrypted_token)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not read the stored Google credentials.",
                ) from exc

            try:
                revoke_google_token(token)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Google access could not be revoked. Try disconnecting again.",
                ) from exc

        try:
            if credential is not None:
                db.delete(credential)

            db.delete(integration)
            db.commit()
        except Exception:
            db.rollback()
            raise    


google_oauth_service = GoogleOAuthService()