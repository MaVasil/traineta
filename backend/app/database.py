"""Compatibility layer re-exporting from backend.app.db.database."""
from backend.app.db.database import (
    Base,
    engine,
    SessionLocal,
    get_db,
    check_db_connection,
    init_db,
    seed_demo_data
)

__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "check_db_connection",
    "init_db",
    "seed_demo_data"
]
