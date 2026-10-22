from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EmailListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    integration_id: int
    external_id: str
    thread_id: str | None = None
    subject: str | None = None
    sender: str | None = None
    recipients: list[str] = []
    snippet: str | None = None
    received_at: datetime | None = None
    is_read: bool = False
    is_starred: bool = False
    labels: list[str] = []


class EmailDetail(EmailListItem):
    cc: list[str] = []
    bcc: list[str] = []
    body_text: str | None = None
    body_html: str | None = None
    created_at: datetime
    updated_at: datetime


class EmailListResponse(BaseModel):
    items: list[EmailListItem]
    total: int
    next_cursor: str | None = None


class EmailUpdate(BaseModel):
    is_read: bool | None = None
    is_starred: bool | None = None
