from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.pending_registrations import PendingRegistration


class PendingRegistrationRepository:
    def get_by_email(
        self,
        db: Session,
        email: str,
    ) -> PendingRegistration | None:
        statement = select(PendingRegistration).where(
            PendingRegistration.email == email
        )
        return db.scalars(statement).first()

    def create(
        self,
        db: Session,
        *,
        email: str,
        password_hash: str,
        first_name: str | None,
        last_name: str | None,
        otp_hash: str,
        expires_at: datetime,
    ) -> PendingRegistration:
        pending = PendingRegistration(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            otp_hash=otp_hash,
            expires_at=expires_at,
            attempt_count=0,
        )
        db.add(pending)
        db.commit()
        db.refresh(pending)
        return pending

    def increment_attempt_count(
        self,
        db: Session,
        pending: PendingRegistration,
    ) -> None:
        pending.attempt_count += 1
        db.commit()

    def update_for_resend(
        self,
        db: Session,
        pending: PendingRegistration,
        *,
        otp_hash: str,
        expires_at: datetime,
        sent_at: datetime,
    ) -> None:
        pending.otp_hash = otp_hash
        pending.expires_at = expires_at
        pending.last_sent_at = sent_at
        pending.resend_count += 1
        pending.attempt_count = 0

        db.commit()

    def delete(
        self,
        db: Session,
        pending: PendingRegistration,
    ) -> None:
        db.delete(pending)
        db.commit()


pending_registration_repo = PendingRegistrationRepository()