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
        if job.job_type not in {"initial", "incremental"}:
            raise ValueError(f"Unsupported sync job type: {job.job_type}")
        if job.status not in {"queued", "running", "failed"}:
            raise ValueError(
                f"This sync job is not ready to run (current status: {job.status})."
            )

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
                    if records_processed % 25 == 0:
                        db.refresh(job)
                        if job.status == "cancelled":
                            break

                    _, created = email_repo.upsert(db, email_data)

                    records_processed += 1
                    
                    if created:
                        records_created += 1
                    else:
                        records_updated += 1

                    if records_processed % 50 == 0:
                        job.records_processed = records_processed
                        job.records_created = records_created
                        job.records_updated = records_updated
                        db.commit()
            finally:
                close_records = getattr(records, "close", None)
                if close_records is not None:
                    close_records()

            db.refresh(job)
            if job.status == "cancelled":
                job.records_processed = records_processed
                job.records_created = records_created
                job.records_updated = records_updated
                db.commit()
                return job

            if result.deleted_external_ids:
                deleted_count = email_repo.delete_by_external_ids(
                    db,
                    integration_id=integration.id,
                    external_ids=list(result.deleted_external_ids),
                )
                records_processed += deleted_count

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

        except Exception as exc:
            db.rollback()

            failed_job = sync_job_repo.get_by_id(db, job_id=job_id)
            if failed_job is not None:
                err_str = str(exc).lower()

                if "invalid_grant" in err_str or "token" in err_str or "unauthorized" in err_str:
                    clean_msg = "Google authorization expired or was revoked. Please reconnect your account."
                elif "quota" in err_str or "rate" in err_str or "429" in err_str:
                    clean_msg = "Google API rate limit reached. Sync will resume shortly."
                elif "timeout" in err_str or "connection" in err_str:
                    clean_msg = "Connection to Google timed out. Please check your network."
                else:
                    clean_msg = f"{job.job_type.capitalize()} sync encountered an issue. Please try again."

                sync_job_repo.mark_failed(
                    db,
                    failed_job,
                    error_code="SYNC_FAILED",
                    error_message=clean_msg,
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

        # If cursor already exists, this is an incremental sync; otherwise initial
        cursor = sync_cursor_repo.get(
            db,
            integration_id=integration.id,
            resource_type=integration.integration_type,
        )
        job_type = "incremental" if (cursor and cursor.cursor_value) else "initial"

        job = sync_job_repo.create(
            db,
            integration_id=integration.id,
            job_type=job_type,
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
                    error_message="Could not queue the sync job. Try again later",
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
    
    def cancel_active_job(
        self,
        db: Session,
        *,
        job_id: int,
        user_id: int,
    ) -> SyncJob:
        job = self.get_job_for_user(db, job_id=job_id, user_id=user_id)
        if job.status not in {"queued", "running"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job with status '{job.status}'.",
            )
        sync_job_repo.mark_cancelled(db, job)
        db.commit()
        db.refresh(job)
        return job


sync_service = SyncService()
