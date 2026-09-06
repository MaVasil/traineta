# TrainETA — Dynamic Railway Intelligence

TrainETA is an intelligent railway platform for real-time train tracking, dynamic ETA prediction, delay intelligence, and railway analytics. By leveraging Machine Learning and real-time positional simulations, TrainETA transforms raw railway telemetry into actionable insights for passengers and operators.

## Features

- **Train Monitoring:** View comprehensive details about ongoing trips, delays, and speeds.
- **Dynamic ETA Prediction:** Real-time arrival estimates adjusting to live network conditions.
- **ML-Based ETA Prediction:** Machine learning models forecasting travel time using delays, distances, and historical metrics.
- **Live Train Tracking:** Interactive map visualization (Google Maps & Leaflet fallback) showing real-time train positions.
- **Simulation Service:** Backend-driven simulated train movement across GIS coordinates when real GPS data is unavailable.
- **Supabase Integration:** Full PostgreSQL database backend for historical tracking, stations, routes, and predictions.
- **REST APIs:** Robust FastAPI endpoints serving train metadata, tracking telemetry, and analytics.

*(Note: AI Assistant features are planned for future implementation.)*

## Technology Stack

| Technology | Purpose |
| ---------- | ------- |
| **React 19** | Frontend UI Framework |
| **Vite** | Fast frontend build tool and development server |
| **JavaScript** | Core frontend language |
| **Tailwind CSS 4** | Utility-first styling and dynamic layouts |
| **FastAPI** | High-performance Python backend API framework |
| **Python** | Backend data processing and ML scripting |
| **Supabase (PostgreSQL)**| Primary relational database |
| **SQLAlchemy** | Python ORM for database interactions |
| **Scikit-Learn** | Machine learning engine for ETA predictions |
| **Google Maps / Leaflet** | Geospatial visualization and interactive maps |

## System Architecture

```text
React Frontend 
      ↓ (Vite Proxy / Fetch API)
FastAPI Backend 
      ↓ (SQLAlchemy ORM)
Supabase PostgreSQL 
      ↓ 
ML Prediction / Simulation Services
```

**Live Tracking Flow:**
1. **Station/Route Coordinates** are fetched from Supabase.
2. **Simulation Service** (FastAPI) interpolates the train's position between stations.
3. **Train Position API** serves the calculated position coordinates.
4. **React Live Tracking** polls the API.
5. **Google Maps / Visual Fallback** dynamically updates the train marker.

## Project Structure

```text
project/
├── backend/                  # FastAPI backend application
│   ├── app/                  # Backend source code (routers, models, services)
│   ├── ml/                   # Machine Learning scripts and artifacts
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Safe template for backend secrets
├── src/                      # React frontend source code
│   ├── components/           # Reusable UI components
│   ├── pages/                # Main application views (LiveTracking, Dashboard, etc.)
│   └── services/             # API connection layers
├── public/                   # Static assets
├── package.json              # Node.js dependencies
├── vite.config.ts            # Vite configuration
├── .env.example              # Safe template for frontend secrets
└── README.md                 # Project documentation
```

## Prerequisites

To run this project locally, you must install:
- **Git**
- **Node.js** (v18+)
- **npm**
- **Python** (3.10+)
- **VS Code** (Recommended)
- **Supabase Account** (For database access)
- **Google Cloud Account** (For Google Maps API Key)

## Clone the Repository

```bash
git clone <repository-url>
cd <project-folder>
```

## Frontend Installation

Install Node modules and start the Vite development server (runs on port 3000):

```bash
npm install
npm run dev
```

## Backend Installation

We recommend using a virtual environment. Commands for Windows:

```powershell
cd backend
python -m venv venv

# If execution policy errors occur, run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

## Environment Variables

> [!WARNING]
> `.env` files contain local configuration and private secrets. **THEY MUST NOT BE COMMITTED TO GITHUB.**

### 1. Frontend `.env`
Create a `.env` file in the **root** directory:
```env
# Google Maps JavaScript API Key (Optional: Demo fallback visualization active if missing)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# TrainETA FastAPI Backend URL (Leave blank to use relative /api proxy)
VITE_API_BASE_URL=

# AI Studio Injection variables (Optional)
GEMINI_API_KEY=your_gemini_api_key
APP_URL=http://localhost:3000
```

### 2. Backend `.env`
Create a `.env` file in the **`backend/`** directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
DATABASE_URL=your_database_url
FRONTEND_URL=http://localhost:3000
PORT=8001
HOST=0.0.0.0
ENVIRONMENT=development
DATA_MODE=PRODUCTION
```

### How Teammates Set Up `.env`
Run these commands in Windows to create your private `.env` files from the templates:
```powershell
copy .env.example .env
copy backend\.env.example backend\.env
```
Once created, securely obtain the actual Supabase database connection strings and keys from the team lead and paste them into your files. Do NOT commit the `.env` files!

## Supabase Setup

The backend connects directly to Supabase via SQLAlchemy using the `DATABASE_URL` (PostgreSQL connection string).
The database relies on the following key tables mapped in `backend/app/models/`:
- `trains`
- `stations`
- `train_routes`
- `train_positions`
- `eta_predictions`

If you are setting up a fresh Supabase project, you must execute the database initialization scripts provided by the team lead to create the schema and seed initial corridor data.

## Google Maps Setup

To enable the premium Google Maps tracking visualization:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the **Maps JavaScript API**.
4. Generate an API Key under Credentials.
5. Restrict the API key to your local development URL (`http://localhost:3000`) and production domains.
6. Add the key to your root `.env` file as `VITE_GOOGLE_MAPS_API_KEY`.
*(If this key is missing, TrainETA will automatically fall back to a beautifully designed Leaflet/SVG interactive map.)*

## Running the Complete Project

You need two separate terminal windows running simultaneously.

**Terminal 1 — Backend:**
```powershell
# From the project root
cd backend
venv\Scripts\Activate.ps1
cd ..
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
```

**Terminal 2 — Frontend:**
```powershell
# From the project root
npm run dev
```
Open `http://localhost:3000` in your browser.

## API Documentation

When the backend is running, you can access the interactive Swagger UI at:  
`http://127.0.0.1:8001/docs`

**Key Endpoints:**
- `GET /api/trains` - List all monitored trains
- `GET /api/trains/search` - Search trains with filters
- `GET /api/trains/{train_id}` - Get metadata for a specific train
- `GET /api/trains/{train_id}/live` - Get live tracking telemetry
- `GET /api/trains/{train_id}/eta` - Trigger ML ETA Prediction
- `GET /api/trains/{train_id}/simulate_step` - Advance the backend tracking simulation by one hop
- `GET /api/stations` - List all corridor stations
- `GET /api/history` - Retrieve historical tracking logs
- `GET /api/analytics` - System metrics and accuracy data

## Live Train Tracking (Stage 6)

The project features a highly interactive Live Tracking page using Google Maps visualization.
- **Simulation Layer:** Currently, real Indian Railway GPS data is not ingested. Instead, we use a sophisticated `SimulationService` that acts exactly like a real GPS provider.
- **Movement:** The backend dynamically interpolates the train's position between actual railway station coordinates. 
- **Data Flow:** React polls the backend `simulate_step` API every few seconds. The backend recalculates the train's delay, speed, and GPS coordinates, saves the state to PostgreSQL, and returns it to the frontend.
- **Future Proof:** This architecture is designed so a real, authorized GPS hardware provider can seamlessly replace the `SimulationService` without altering the frontend.

## ML ETA Prediction

TrainETA uses a trained **Scikit-Learn Regression Model** (`eta_model.joblib`) to predict dynamic arrivals.
- **Input Features:** `current_delay`, `speed`, `distance_km`, `scheduled_hour`, `day_of_week`, `avg_station_delay`
- **Output:** Predicted remaining travel time in minutes.
- **Implementation:** The `MLEtaPredictor` extracts real-time features from the database, feeds them to the model, and calculates an algorithmic confidence score based on the model's R² metric and remaining distance. 

## Testing Checklist

Before submitting a Pull Request, ensure:
- [ ] Backend starts successfully without errors
- [ ] Frontend starts successfully without errors
- [ ] Supabase connection works (Database not throwing 500s)
- [ ] `/api/trains` returns data
- [ ] ETA API successfully returns an ML prediction
- [ ] Simulation API `/api/trains/{id}/simulate_step` works
- [ ] Live Tracking page loads and the train marker moves
- [ ] No browser console errors

## Troubleshooting

- **`ModuleNotFoundError: No module named 'fastapi'`**: You forgot to activate your virtual environment (`venv\Scripts\Activate.ps1`) before running the server.
- **Backend not starting / Port 8001 in use**: Another terminal might be running the backend. Find it and stop it (`Ctrl+C`), or change the port.
- **Missing environment variables**: Ensure you copied `.env.example` to `.env` in both the root and `backend/` folders.
- **Supabase connection failure**: Check `DATABASE_URL` in `backend/.env`. Ensure you are connected to the internet.
- **Google Maps not loading / displaying errors**: Ensure `VITE_GOOGLE_MAPS_API_KEY` is correct, and that Maps JavaScript API is enabled in Google Cloud Console.

## Git Workflow for Team

Always work on feature branches. **Do not commit directly to main.**

```bash
git pull
git checkout -b feature/my-feature

# ...make your changes...

git add .
git commit -m "Add my feature"
git push -u origin feature/my-feature
```
Open a Pull Request on GitHub to merge your feature.

## Environment File Security

```text
.env                 ❌ DO NOT COMMIT
backend/.env         ❌ DO NOT COMMIT
.env.example         ✅ COMMIT
backend/.env.example ✅ COMMIT
```
Ask the Team Lead privately for the Supabase production credentials.

## Current Project Status

| Stage              | Status                                   |
| ------------------ | ---------------------------------------- |
| Frontend           | Completed                                |
| Backend            | Completed                                |
| Database           | Completed                                |
| System Integration | Completed                                |
| ML ETA             | Completed                                |
| Live Tracking      | Completed                                |
| Google Maps        | Completed                                |
| AI Assistant       | Not started                              |
| Deployment         | Pending                                  |

## Future Roadmap

- Real authorized railway GPS integration
- Railway AI Assistant for conversational queries
- Advanced delay intelligence and weather impact mapping
- Passenger notifications and alert system
- Operations dashboard analytics
- Production deployment to Vercel/Cloud Run
