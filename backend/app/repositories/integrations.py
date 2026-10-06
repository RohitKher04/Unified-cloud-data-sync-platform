from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.integrations import Integration


class IntegrationRepository:
    def get_by_account(
        self,
        db: Session,
        *,
        user_id: int,
        provider: str,
        integration_type: str,
        external_account_id: str,
    ) -> Integration | None:
        statement = select(Integration).where(
            Integration.user_id == user_id,
            Integration.provider == provider,
            Integration.integration_type == integration_type,
            Integration.external_account_id == external_account_id,
        )
        return db.scalars(statement).first()

    def create(
        self,
        db: Session,
        *,
        user_id: int,
        provider: str,
        integration_type: str,
        external_account_id: str,
        external_email: str,
    ) -> Integration:
        integration = Integration(
            user_id=user_id,
            provider=provider,
            integration_type=integration_type,
            external_account_id=external_account_id,
            external_email=external_email,
            status="connected",
        )
        db.add(integration)
        db.flush()
        return integration

    def list_for_user(
        self,
        db: Session,
        *,
        user_id: int,
    ) -> list[Integration]:
        statement = (
            select(Integration)
            .where(Integration.user_id == user_id)
            .order_by(Integration.created_at.desc())
        )
        return list(db.scalars(statement).all())

    def get_by_id_for_user(
        self,
        db: Session,
        *,
        integration_id: int,
        user_id: int,
    ) -> Integration | None:
        statement = select(Integration).where(
            Integration.id == integration_id,
            Integration.user_id == user_id,
        )
        return db.scalars(statement).first()    


integration_repo = IntegrationRepository()