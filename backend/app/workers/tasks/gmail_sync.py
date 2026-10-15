from celery.utils.log import get_task_logger

from app.db.session import SessionLocal
from app.services.sync.service import sync_service
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.tasks.gmail_sync.run_initial_gmail_sync",
    ignore_result=True,
    autoretry_for=(Exception,),
    dont_autoretry_for=(ValueError,),
    max_retries=3,
    retry_backoff=30,
    retry_backoff_max=300,
    retry_jitter=True,
    soft_time_limit=3300,
    time_limit=3600,
)
def run_initial_gmail_sync(self, job_id: int) -> dict[str, int | str]:
    logger.info("Starting Gmail sync job_id=%s", job_id)
    db = SessionLocal()

    try:
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
