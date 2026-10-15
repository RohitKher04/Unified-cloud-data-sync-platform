from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.sync_jobs import SyncJob


class SyncJobRepository:
    def get_by_id(
        self,
        db: Session,
        *,
        job_id: int,
    ) -> SyncJob | None:
        return db.get(SyncJob, job_id)

    def create(
        self,
        db: Session,
        *,
        integration_id: int,
        job_type: str,
    ) -> SyncJob:
        job = SyncJob(
            integration_id=integration_id,
            job_type=job_type,
            status="queued",
        )
        db.add(job)
        db.flush()
        return job

    def mark_running(self, db: Session, job: SyncJob) -> None:
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.error_code = None
        job.error_message = None
        db.flush()

    def mark_completed(
        self,
        db: Session,
        job: SyncJob,
        *,
        records_processed: int,
        records_created: int,
        records_updated: int,
    ) -> None:
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.records_processed = records_processed
        job.records_created = records_created
        job.records_updated = records_updated
        db.flush()

    def mark_failed(
        self,
        db: Session,
        job: SyncJob,
        *,
        error_code: str,
        error_message: str,
        records_processed: int = 0,
        records_created: int = 0,
        records_updated: int = 0,
    ) -> None:
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_code = error_code
        job.error_message = error_message
        job.records_processed = records_processed
        job.records_created = records_created
        job.records_updated = records_updated
        db.flush()

    def get_active_job_for_integration(
        self,
        db: Session,
        *,
        integration_id: int,
    ) -> SyncJob | None:
        statement = select(SyncJob).where(
            SyncJob.integration_id == integration_id,
            SyncJob.status.in_(["queued", "running"]),
        )
        return db.scalars(statement).first()


sync_job_repo = SyncJobRepository()