from datetime import datetime, timezone

from sqlalchemy.orm import Session

from fastapi import HTTPException, status

from app.db.models.sync_jobs import SyncJob
from app.providers.base import SyncContext
from app.providers.registry import provider_registry
from app.repositories.emails import email_repo
from app.repositories.integrations import integration_repo
from app.repositories.sync_cursors import sync_cursor_repo
from app.repositories.sync_jobs import sync_job_repo

from app.providers.registry import ProviderNotRegisteredError
from app.workers.celery_app import celery_app

class SyncService:
    def run_initial_sync(
        self,
        db: Session,
        *,
        job_id: int,
    ) -> SyncJob:
        job = sync_job_repo.get_by_id(db, job_id=job_id)

        if job is None:
            raise ValueError("Sync job was not found.")
        if job.job_type != "initial":
            raise ValueError("This service currently supports initial sync only.")
        if job.status not in {"queued", "failed"}:
            raise ValueError("This sync job is not ready to run.")

        integration = integration_repo.get_by_id(
            db,
            integration_id=job.integration_id,
        )
        if integration is None:
            raise ValueError("Integration was not found.")
        if integration.status != "connected":
            raise ValueError("Integration is not connected.")

        provider = provider_registry.get(
            provider=integration.provider,
            integration_type=integration.integration_type,
        )

        records_processed = 0
        records_created = 0
        records_updated = 0

        try:
            cursor = sync_cursor_repo.get(
                db,
                integration_id=integration.id,
                resource_type=integration.integration_type,
            )

            credentials = provider.refresh_credentials(
                db,
                integration_id=integration.id,
            )

            sync_job_repo.mark_running(db, job)
            db.commit()

            result = provider.sync(
                SyncContext(
                    integration=integration,
                    cursor=cursor,
                    credentials=credentials,
                )
            )

            records = iter(result.records)
            try:
                for email_data in records:
                    _, created = email_repo.upsert(db, email_data)

                    records_processed += 1
                    if created:
                        records_created += 1
                    else:
                        records_updated += 1

                    if records_processed % 100 == 0:
                        db.commit()
            finally:
                close_records = getattr(records, "close", None)
                if close_records is not None:
                    close_records()

            completed_at = datetime.now(timezone.utc)

            sync_cursor_repo.upsert(
                db,
                integration_id=integration.id,
                provider=integration.provider,
                resource_type=integration.integration_type,
                cursor_value=result.cursor_value,
                last_successful_sync_at=completed_at,
            )

            integration.last_synced_at = completed_at

            sync_job_repo.mark_completed(
                db,
                job,
                records_processed=records_processed,
                records_created=records_created,
                records_updated=records_updated,
            )
            db.commit()
            db.refresh(job)
            return job

        except Exception:
            db.rollback()

            failed_job = sync_job_repo.get_by_id(db, job_id=job_id)
            if failed_job is not None:
                sync_job_repo.mark_failed(
                    db,
                    failed_job,
                    error_code="INITIAL_SYNC_FAILED",
                    error_message=(
                        "Initial sync failed. Check server logs for details."
                    ),
                    records_processed=records_processed,
                    records_created=records_created,
                    records_updated=records_updated,
                )
                db.commit()

            raise

    def enqueue_initial_sync(
        self,
        db: Session,
        *,
        integration_id: int,
        user_id: int,
    ) -> SyncJob:
        
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
        if integration.status != "connected":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Integration is not connected.",
            )

        try:
            provider_registry.get(
                provider=integration.provider,
                integration_type=integration.integration_type,
            )
        except ProviderNotRegisteredError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sync is not supported for this integration.",
            ) from exc

        
        active_job = sync_job_repo.get_active_job_for_integration(
            db,
            integration_id=integration.id,
        )
        if active_job is not None:
            return active_job

        job = sync_job_repo.create(
            db,
            integration_id=integration.id,
            job_type="initial",
        )
        db.commit()
        db.refresh(job)

        
        try:
            celery_app.send_task(
                "app.workers.tasks.gmail_sync.run_initial_gmail_sync",
                args=[job.id],
            )
        except Exception as exc:
            db.rollback()
            failed_job = sync_job_repo.get_by_id(db, job_id=job.id)
            if failed_job is not None:
                sync_job_repo.mark_failed(
                    db,
                    failed_job,
                    error_code="TASK_ENQUEUE_FAILED",
                    error_message="Could not queue the sync job.",
                )
                db.commit()

            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not queue the sync job. Try again later.",
            ) from exc

        return job

    def get_job_for_user(
        self,
        db: Session,
        *,
        job_id: int,
        user_id: int,
    ) -> SyncJob:
        
        job = sync_job_repo.get_by_id(db, job_id=job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sync job not found.",
            )

        integration = integration_repo.get_by_id_for_user(
            db,
            integration_id=job.integration_id,
            user_id=user_id,
        )
        if integration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sync job not found.",
            )

        return job


    def list_jobs_for_user(
        self,
        db: Session,
        *,
        user_id: int,
        limit: int = 50,
    ) -> list[SyncJob]:
        return sync_job_repo.list_for_user(
            db,
            user_id=user_id,
            limit=limit,
        )


sync_service = SyncService()
