from pathlib import Path

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import user, workspace  # noqa: F401


async def init_db() -> None:
    if settings.database_url.startswith("sqlite"):
        Path("data").mkdir(exist_ok=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
