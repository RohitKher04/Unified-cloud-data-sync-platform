from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.db.models.users import User
from app.db.session import get_db
from app.schemas.sync import SyncJobQueued, SyncJobResponse
from app.services.sync.service import sync_service

router = APIRouter()


@router.post(
    "/integrations/{integration_id}/sync",
    response_model=SyncJobQueued,
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_initial_sync(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncJobQueued:
    job = sync_service.enqueue_initial_sync(
        db,
        integration_id=integration_id,
        user_id=current_user.id,
    )
    return SyncJobQueued(job_id=job.id, status=job.status)


@router.get(
    "/sync/jobs/{job_id}",
    response_model=SyncJobResponse,
)
def get_sync_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncJobResponse:
    job = sync_service.get_job_for_user(
        db,
        job_id=job_id,
        user_id=current_user.id,
    )
    return SyncJobResponse.model_validate(job)
