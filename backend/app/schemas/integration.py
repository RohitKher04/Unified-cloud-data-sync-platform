from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class GoogleConnectResponse(BaseModel):
    authorization_url: str


class IntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    integration_type: str
    external_email: EmailStr
    status: str
    last_synced_at: datetime | None = None
    created_at: datetime | None = None
