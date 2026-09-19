from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    mode: str
    created_at: datetime | None
