from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.core.security import (
    generate_email_otp,
    hash_email_otp,
    verify_email_otp,
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.repositories.users import user_repo
from app.repositories.user_sessions import user_session_repo
from app.repositories.pending_registrations import pending_registration_repo

from app.services.auth.email_sender import send_email_verification_code

from app.schemas.auth import TokenResponse, RegistrationPendingResponse
from app.schemas.user import UserCreate


class AuthService:
    def register(
    self,
    db: Session,
    user_in: UserCreate,
    ) -> RegistrationPendingResponse:
        existing_user = user_repo.get_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

        existing_pending = pending_registration_repo.get_by_email(
            db,
            user_in.email,
        )
        if existing_pending:
            if existing_pending.expires_at <= datetime.now(timezone.utc):
                pending_registration_repo.delete(db, existing_pending)
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email verification is already pending for this address.",
                )

        otp = generate_email_otp()

        pending_registration_repo.create(
            db,
            email=user_in.email,
            password_hash=hash_password(user_in.password),
            first_name=user_in.first_name,
            last_name=user_in.last_name,
            otp_hash=hash_email_otp(otp),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )

        try:
            send_email_verification_code(user_in.email, otp)
        except Exception as exc:
            pending = pending_registration_repo.get_by_email(db, user_in.email)
            if pending:
                pending_registration_repo.delete(db, pending)

            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not send the verification email. Please try again.",
            ) from exc

        return RegistrationPendingResponse(
            message="Verification code sent. Enter it to finish creating your account."
        )

    def verify_email(self, db: Session, email: str, otp: str) -> TokenResponse:
        pending = pending_registration_repo.get_by_email(db, email)

        if not pending:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pending email verification was found.",
            )

        if pending.expires_at <= datetime.now(timezone.utc):
            pending_registration_repo.delete(db, pending)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="The verification code expired. Please register again.",
            )

        if not verify_email_otp(otp, pending.otp_hash):
            pending_registration_repo.increment_attempt_count(db, pending)

            if pending.attempt_count >= 5:
                pending_registration_repo.delete(db, pending)

                raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect verification attempts. Please register again.",
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The verification code is invalid or expired.",
            )

        existing_user = user_repo.get_by_email(db, email)
        if existing_user:
            pending_registration_repo.delete(db, pending)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

        user = user_repo.create_verified_user(
            db,
            email=pending.email,
            password_hash=pending.password_hash,
            first_name=pending.first_name,
            last_name=pending.last_name,
        )

        pending_registration_repo.delete(db, pending)
        return self._issue_tokens(db, user.id)

    def resend_email_otp(
        self,
        db: Session,
        email: str,
    ) -> RegistrationPendingResponse:
        pending = pending_registration_repo.get_by_email(db, email)

        if not pending:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pending email verification was found.",
            )

        now = datetime.now(timezone.utc)

        if pending.expires_at <= now:
            pending_registration_repo.delete(db, pending)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="The verification period expired. Please register again.",
            )

        if pending.resend_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="The resend limit has been reached. Use the latest code, "
                        "or wait for it to expire before registering again.",
            )

        seconds_since_last_send = (now - pending.last_sent_at).total_seconds()
        if seconds_since_last_send < 60:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait 60 seconds between verification code requests.",
            )

        otp = generate_email_otp()

        pending_registration_repo.update_for_resend(
            db,
            pending,
            otp_hash=hash_email_otp(otp),
            expires_at=now + timedelta(minutes=5),
            sent_at=now,
            )

        try:
            send_email_verification_code(email, otp)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not send the verification email. Please try again.",
            ) from exc

       

        return RegistrationPendingResponse(
            message="A new verification code was sent to your email."
        )

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