import logging
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, check_db_connection
from app.routers import (
    trains_router,
    stations_router,
    routes_router,
    tracking_router,
    predictions_router,
    history_router,
    admin_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("traineta.backend")

# WebSocket connection manager for live tracking
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

ws_manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB schema & seed demo data
    logger.info("Starting TrainETA Backend v%s ...", settings.VERSION)
    try:
        init_db()
        logger.info("Database schema initialized and verified.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    # Check if ML model is available
    try:
        from app.ml.predictor import ml_predictor
        if ml_predictor.is_available():
            logger.info("ML Model loaded: %s (MAE: %s min)", 
                       ml_predictor.metadata.get("model_name", "Unknown"),
                       ml_predictor.metadata.get("MAE", "N/A"))
        else:
            logger.warning("ML Model not available — using baseline heuristic predictions")
    except Exception as e:
        logger.warning(f"ML predictor check failed: {e}")
    
    yield
    # Shutdown
    logger.info("Stopping TrainETA Backend...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
# 🚆 TrainETA API — Dynamic Railway Intelligence

Professional railway intelligence and passenger train-tracking platform backend.
Connected to Supabase PostgreSQL database for persistent train corridors, telemetry, and arrival predictions.

### Key API Resources:
* **Health**: `/health` - Infrastructure and database connectivity check.
* **Trains**: `/api/trains`, `/api/trains/{train_id}`, `/api/trains/search`
* **Stations**: `/api/stations`, `/api/stations/{station_id}`
* **Route**: `/api/trains/{train_id}/route`
* **Map**: `/api/trains/{train_id}/map`
* **Position**: `/api/trains/{train_id}/position`
* **ETA Predictions**: `/api/trains/{train_id}/eta`
* **Timeline**: `/api/trains/{train_id}/timeline`
* **History**: `/api/history`
* **Analytics**: `/api/analytics`
* **WebSocket**: `/ws/tracking` - Live position updates

*Disclaimer: DEMO / SIMULATED DATA. Current records represent simulated corridor operations.*
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS to permit all local and preview environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Disable HTTP caching for all API responses so updates reflect immediately
@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Root Endpoint
@app.get("/", tags=["System"], summary="API Root")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "websocket": "/ws/tracking",
        "data_mode": "DEMO / SIMULATED DATA"
    }

# Health Check Endpoints
@app.get("/health", tags=["System"], summary="System health and database check")
def health_check():
    """
    Returns database connectivity status:
    { "status": "healthy", "database": "connected" }
    or
    { "status": "degraded", "database": "unavailable" }
    """
    return check_db_connection()

@app.get("/api/health", tags=["System"], summary="API Health check alias")
def api_health_check():
    """Alias for /health to support /api prefixed clients."""
    return check_db_connection()

@app.get("/api/system/status", tags=["System"], summary="System status report")
def system_status():
    """Returns infrastructure connectivity and mode status."""
    db_status = check_db_connection()
    
    # Check ML model
    ml_status = "unavailable"
    ml_model = None
    try:
        from app.ml.predictor import ml_predictor
        if ml_predictor.is_available():
            ml_status = "loaded"
            ml_model = ml_predictor.metadata.get("model_name", "Unknown")
    except Exception:
        pass
    
    return {
        "backend": "operational",
        "database": db_status.get("database", "connected"),
        "ml_model": ml_status,
        "ml_model_name": ml_model,
        "simulation": "active",
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
        "websocket": "/ws/tracking",
        "data_mode": "DEMO / SIMULATED DATA"
    }

# WebSocket endpoint for live train tracking
@app.websocket("/ws/tracking")
async def websocket_tracking(websocket: WebSocket):
    """
    WebSocket endpoint for real-time train position updates.
    Sends simulated position updates every 2 seconds.
    """
    await ws_manager.connect(websocket)
    try:
        # Send initial train data
        from app.database import SessionLocal
        from app.services.train_service import TrainService
        
        db = SessionLocal()
        try:
            trains = TrainService.get_all_trains(db)
            await websocket.send_json({
                "type": "initial_data",
                "trains": trains,
                "timestamp": __import__("datetime").datetime.utcnow().isoformat()
            })
        finally:
            db.close()
        
        # Keep connection alive and listen for messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
                msg = json.loads(data)
                
                if msg.get("type") == "request_update":
                    db = SessionLocal()
                    try:
                        trains = TrainService.get_all_trains(db)
                        await websocket.send_json({
                            "type": "position_update",
                            "trains": trains,
                            "timestamp": __import__("datetime").datetime.utcnow().isoformat()
                        })
                    finally:
                        db.close()
                        
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
                
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

# Register Feature Routers
app.include_router(trains_router)
app.include_router(stations_router)
app.include_router(routes_router)
app.include_router(tracking_router)
app.include_router(predictions_router)
app.include_router(history_router)
app.include_router(admin_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
