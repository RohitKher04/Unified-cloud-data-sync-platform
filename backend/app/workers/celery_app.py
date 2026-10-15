from celery import Celery

from app.core.config import settings

import app.db.models.users
import app.db.models.user_sessions
import app.db.models.integrations
import app.db.models.integration_credentials
import app.db.models.sync_jobs  
import app.db.models.sync_cursors  
import app.db.models.emails

celery_app = Celery(
    "sync_platform",
    broker=settings.redis_url,
    include=["app.workers.tasks.gmail_sync"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)