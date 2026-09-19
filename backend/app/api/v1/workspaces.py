from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceResponse

router = APIRouter()


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(current_user: CurrentUser, db: DbSession) -> list[Workspace]:
    result = await db.scalars(
        select(Workspace)
        .where(Workspace.owner_id == current_user.id)
        .order_by(Workspace.created_at)
    )
    return list(result)
