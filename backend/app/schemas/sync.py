from datetime import datetime

from pydantic import BaseModel


class SyncJobResponse(BaseModel):
    id: int
    integration_id: int
    job_type: str
    status: str
    records_processed: int
    records_created: int
    records_updated: int
    error_code: str | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SyncJobQueued(BaseModel):
    job_id: int
    status: str