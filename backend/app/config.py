import os
import re
import urllib.parse
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Search for .env in current dir, backend dir, or parent dirs
env_candidates = [
    Path.cwd() / "backend" / ".env",
    Path.cwd() / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / "backend" / ".env",
]
for p in env_candidates:
    if p.exists():
        load_dotenv(dotenv_path=p, override=False)
        break
load_dotenv()

class Settings:
    PROJECT_NAME: str = "TrainETA Backend"
    VERSION: str = "2.2.0"
    DESCRIPTION: str = "Dynamic Railway Intelligence Backend API with ML Prediction Engine"
    
    # Supabase & Database configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        raw = self.DATABASE_URL or os.getenv("DATABASE_URL", "")
        if raw and raw.strip():
            uri = raw.strip()
            while "DATABASE_URL=" in uri:
                uri = uri.split("DATABASE_URL=", 1)[-1].strip()
            
            if uri.startswith("postgres://"):
                uri = uri.replace("postgres://", "postgresql://", 1)
            
            m = re.match(r"^(postgresql://)([^:]+):(.*)@([^/@]+)(/.*)$", uri)
            if m:
                proto, user, pwd, hostport, dbname = m.groups()
                if ("@" in pwd and "%40" not in pwd) or ("%" in pwd and "%25" not in pwd):
                    pwd = urllib.parse.quote_plus(pwd)
                uri = f"{proto}{user}:{pwd}@{hostport}{dbname}"
                
            return uri
        # SQLite fallback — use forward slashes for cross-platform compatibility
        db_dir = Path(__file__).resolve().parent.parent.parent
        db_path = db_dir / "traineta.db"
        return f"sqlite:///{db_path.as_posix()}"

    # Server & CORS configuration
    PORT: int = int(os.getenv("PORT", "8001"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATA_MODE: str = os.getenv("DATA_MODE", "DEMO_SIMULATED")
    
    # Real Railway API configuration
    TRAIN_DATA_PROVIDER: str = os.getenv("TRAIN_DATA_PROVIDER", "SIMULATED")
    RAILRADAR_API_KEY: str = os.getenv("RAILRADAR_API_KEY", "")

    # Phase 5 Real-Time Operational Pipeline configuration
    RAILRADAR_POLL_INTERVAL_SECONDS: int = int(os.getenv("RAILRADAR_POLL_INTERVAL_SECONDS", "300"))
    TRAIN_DATA_STALE_THRESHOLD_SECONDS: int = int(os.getenv("TRAIN_DATA_STALE_THRESHOLD_SECONDS", "1800"))
    PIPELINE_ACTIVE_TRAINS: str = os.getenv("PIPELINE_ACTIVE_TRAINS", "12759,12760,12401,12605,12728,12704,12616")
    PIPELINE_ENABLED: bool = os.getenv("PIPELINE_ENABLED", "true").lower() in ("true", "1", "yes")

    @property
    def CORS_ORIGINS(self) -> List[str]:
        origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]
        if self.FRONTEND_URL and self.FRONTEND_URL.strip() and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL.strip())
        return origins

settings = Settings()
