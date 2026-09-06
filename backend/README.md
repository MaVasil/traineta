# 🚆 TrainETA Backend Service

Dynamic Railway Intelligence Platform — Backend Service built with **FastAPI**, **Pydantic**, **SQLAlchemy**, and **Supabase PostgreSQL**.

---

## ⚠️ Data Mode Notice: DEMO / SIMULATED DATA
> All railway tracking records, GPS telemetry, signal delays, and arrival predictions within this platform represent **DEMO / SIMULATED DATA** along the South Central Railway corridor (Hyderabad ↔ Chennai). This prototype demonstrates database-backed tracking architecture and does not claim to stream live CRIS/NTES Indian Railways feeds.

---

## 🛠️ Technology Stack

* **Language & Framework:** Python 3.10+ / FastAPI
* **Web Server:** Uvicorn (ASGI)
* **Database Engine:** Supabase PostgreSQL
* **ORM:** SQLAlchemy 2.0+
* **Validation:** Pydantic v2
* **Driver:** psycopg2-binary

---

## 🪟 Windows PowerShell Setup & Run Instructions

### Step 1: Open PowerShell and Navigate to Backend
```powershell
cd C:\path\to\TrainETA\backend
```

### Step 2: Create and Activate Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*Note: If script execution is disabled on PowerShell, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`*

### Step 3: Install Required Dependencies
```powershell
pip install -r requirements.txt
```

### Step 4: Configure Supabase Credentials
Ensure your `backend\.env` file contains your Supabase PostgreSQL connection string:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-key
DATABASE_URL=postgresql://postgres.your-project-id:your-db-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### Step 5: Start the FastAPI Backend
```powershell
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🐧 Linux / macOS Run Instructions

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔍 Database Verification Steps

### 1. Automated Health Check Endpoint
Open your browser or run:
```bash
curl http://localhost:8000/health
```
**Expected Output:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 2. Verify Database Records via CLI
Run the following one-line verification script:
```bash
python -c "from backend.app.db.database import SessionLocal, check_db_connection; from backend.app.models import Train, Station; db = SessionLocal(); print('Health:', check_db_connection()); print('Trains in DB:', db.query(Train).count()); print('Stations in DB:', db.query(Station).count()); db.close()"
```
**Expected Output:**
```text
Health: {'status': 'healthy', 'database': 'connected'}
Trains in DB: 6
Stations in DB: 5
```

### 3. Interactive Documentation
Explore live endpoints and payloads via Swagger UI:
* **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 Key API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/health` | `GET` | Database & backend connectivity probe |
| `/api/trains` | `GET` | List all express trains with live status |
| `/api/trains/search` | `GET` | Filter trains by query, origin, destination, status |
| `/api/trains/{train_id}` | `GET` | Get single train details |
| `/api/trains/{train_id}/route` | `GET` | Transit stations in sequence with GPS coordinates |
| `/api/trains/{train_id}/map` | `GET` | Complete Leaflet payload (position, route, milestones) |
| `/api/trains/{train_id}/position` | `GET` | Latest locomotive position from `train_positions` |
| `/api/trains/{train_id}/eta` | `GET` | Baseline ETA prediction |
| `/api/trains/{train_id}/timeline` | `GET` | Route timeline categorized into COMPLETED/CURRENT/UPCOMING |
| `/api/stations` | `GET` | List corridor stations with validated coordinates |
| `/api/history` | `GET` | Historical run audit comparing scheduled vs actual arrival |
| `/api/analytics` | `GET` | Database-calculated network operational analytics |
