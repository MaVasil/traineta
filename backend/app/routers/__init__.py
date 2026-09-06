from app.routers.trains import router as trains_router
from app.routers.stations import router as stations_router
from app.routers.routes import router as routes_router
from app.routers.tracking import router as tracking_router
from app.routers.predictions import router as predictions_router
from app.routers.history import router as history_router
from app.routers.admin import router as admin_router

__all__ = [
    "trains_router",
    "stations_router",
    "routes_router",
    "tracking_router",
    "predictions_router",
    "history_router",
    "admin_router",
]
