from celery.utils.log import get_task_logger
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.services.sync.service import sync_service
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.tasks.gmail_sync.run_initial_gmail_sync",
    ignore_result=True,
    autoretry_for=(Exception,),
    dont_autoretry_for=(ValueError,HTTPException),
    max_retries=5,
    retry_backoff=60,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=3300,
    time_limit=3600,
)
def run_initial_gmail_sync(self, job_id: int) -> dict[str, int | str]:
    logger.info(
        "Starting Gmail sync job_id=%s attempt=%s",
        job_id,
        self.request.retries + 1,
    )
    db = SessionLocal()

    try:
        if self.request.retries > 0:
            from app.repositories.sync_jobs import sync_job_repo
            db_job = sync_job_repo.get_by_id(db, job_id=job_id)
            if db_job:
                db_job.retry_count = self.request.retries
                db.commit()

        job = sync_service.run_initial_sync(db, job_id=job_id)
        logger.info(
            "Finished Gmail sync for job_id=%s status=%s processed=%s",
            job.id,
            job.status,
            job.records_processed,
        )
        return {
            "job_id": job.id,
            "status": job.status,
            "records_processed": job.records_processed,
        }
    finally:
        db.close()
