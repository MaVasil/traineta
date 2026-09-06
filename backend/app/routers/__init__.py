from backend.app.routers.trains import router as trains_router
from backend.app.routers.stations import router as stations_router
from backend.app.routers.routes import router as routes_router
from backend.app.routers.tracking import router as tracking_router
from backend.app.routers.predictions import router as predictions_router
from backend.app.routers.history import router as history_router
from backend.app.routers.admin import router as admin_router

__all__ = [
    "trains_router",
    "stations_router",
    "routes_router",
    "tracking_router",
    "predictions_router",
    "history_router",
    "admin_router",
]
