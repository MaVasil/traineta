"""Compatibility layer re-exporting from app.db.database."""
from app.db.database import (
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
