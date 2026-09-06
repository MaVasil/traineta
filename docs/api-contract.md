# TrainETA API Contract & Database Specification

**Data Mode Notice:**
> ⚠️ **DEMO / SIMULATED DATA**
> All records, GPS telemetry, delays, and arrival estimations served by this API are simulated demonstration data for the South Central Railway corridor (Hyderabad ↔ Chennai). This system does not claim to stream live Indian Railways CRIS/NTES data.

---

## 1. Architectural Overview

```text
React Frontend (Vite/Tailwind)
       ↓  (HTTP REST / CORS)
FastAPI Backend (Uvicorn / Python 3.10)
       ↓  (SQLAlchemy 2.0 / psycopg2)
Supabase PostgreSQL (Cloud Database)
       ↓  (Future ML Pipeline)
Future ML ETA Engine (LightGBM/XGBoost)
```

---

## 2. API Endpoints Reference

### 2.1 System & Health

#### `GET /health`
Verifies live connection to Supabase PostgreSQL without exposing connection strings or passwords.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

**Degraded Response (200 OK):**
```json
{
  "status": "degraded",
  "database": "unavailable"
}
```

---

### 2.2 Trains & Corridor Routes

#### `GET /api/trains`
Returns all monitored express trains with their current terminal milestones and status.

**Database Mapping:** `trains` JOIN `stations`, latest `train_positions`

**Response (200 OK):**
```json
[
  {
    "id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01",
    "train_id": "12401",
    "train_number": "12401",
    "train_name": "Demo Express",
    "source": "Hyderabad",
    "source_code": "HYB",
    "destination": "Chennai",
    "destination_code": "MAS",
    "status": "MINOR_DELAY",
    "delay_minutes": 6
  }
]
```

#### `GET /api/trains/search`
Search trains with parameterized filters.

**Query Parameters:**
* `q`: Search keyword (e.g. `12401`, `Demo`, `Hyderabad`)
* `status`: Filter by `ON_TIME`, `MINOR_DELAY`, `MAJOR_DELAY`
* `source`: Origin city name
* `destination`: Destination city name

**Database Mapping:** Safe parameterized query against `trains` and `stations`.

---

#### `GET /api/trains/{train_id}`
Returns details for a single train by train number (`12401`) or UUID.

---

#### `GET /api/trains/{train_id}/route`
Returns route stations in `sequence_number ASC` order along with track coordinates.

**Database Mapping:** `train_routes` JOIN `stations`

**Response (200 OK):**
```json
{
  "train_id": "12401",
  "train_number": "12401",
  "train_name": "Demo Express",
  "stations": [
    {
      "sequence": 1,
      "station_name": "Hyderabad Deccan",
      "station_code": "HYB",
      "latitude": 17.392000,
      "longitude": 78.473500,
      "scheduled_arrival": null,
      "scheduled_departure": "18:30",
      "distance_from_source": 0.0
    },
    {
      "sequence": 2,
      "station_name": "Kazipet Junction",
      "station_code": "KZJ",
      "latitude": 17.978400,
      "longitude": 79.516700,
      "scheduled_arrival": "20:45",
      "scheduled_departure": "20:50",
      "distance_from_source": 132.0
    }
  ],
  "route_coordinates": [
    [17.392000, 78.473500],
    [17.978400, 79.516700]
  ]
}
```

---

### 2.3 Geospatial & Telemetry

#### `GET /api/trains/{train_id}/map`
Returns complete geospatial payload required for Leaflet rendering.

**Database Mapping:** `train_positions` (latest), `train_routes`, `stations`

**Response (200 OK):**
```json
{
  "train_id": "12401",
  "current_position": {
    "latitude": 17.968900,
    "longitude": 79.594100
  },
  "current_station": "Warangal",
  "next_station": "Vijayawada Junction",
  "speed": 78,
  "delay_minutes": 6,
  "timestamp": "2026-09-05T18:32:51.112733+00:00",
  "stations": [ ... ],
  "route_coordinates": [ ... ]
}
```

---

#### `GET /api/trains/{train_id}/position`
Reads latest locomotive GPS coordinate and block delay from `train_positions` using the most recent timestamp.

**Response (200 OK):**
```json
{
  "train_id": "12401",
  "latitude": 17.9689,
  "longitude": 79.5941,
  "current_station": "Warangal",
  "next_station": "Vijayawada Junction",
  "speed": 78,
  "delay": 6,
  "delay_minutes": 6,
  "timestamp": "2026-09-05T18:32:51.112733+00:00"
}
```

---

### 2.4 Dynamic ETA Predictions

#### `GET /api/trains/{train_id}/eta`
Baseline ETA prediction following the modular architecture:
`eta.py -> eta_service.py -> prediction_service.py -> ETAPredictor`

**Response (200 OK):**
```json
{
  "train_id": "12401",
  "scheduled_eta": "22:36",
  "predicted_eta": "22:42",
  "predicted_delay": 6,
  "confidence": 0.82,
  "prediction_type": "BASELINE",
  "model_version": "v1-baseline",
  "data_mode": "DEMO / SIMULATED DATA"
}
```

---

### 2.5 Timeline

#### `GET /api/trains/{train_id}/timeline`
Builds sequential timeline partitioned into `COMPLETED`, `CURRENT`, and `UPCOMING`.

**Response (200 OK):**
```json
{
  "train_id": "12401",
  "train_number": "12401",
  "train_name": "Demo Express",
  "current_station": "Warangal",
  "next_station": "Vijayawada Junction",
  "timeline": [
    {
      "sequence": 1,
      "station_name": "Hyderabad Deccan",
      "station_code": "HYB",
      "status": "COMPLETED",
      "distance_from_source": 0.0
    },
    {
      "sequence": 3,
      "station_name": "Warangal",
      "station_code": "WL",
      "status": "CURRENT",
      "distance_from_source": 142.0
    },
    {
      "sequence": 4,
      "station_name": "Vijayawada Junction",
      "station_code": "BZA",
      "status": "UPCOMING",
      "distance_from_source": 349.0
    }
  ]
}
```

---

### 2.6 Stations API

#### `GET /api/stations`
Lists all stations with verified numerical float coordinates.

**Database Mapping:** `stations`

**Response (200 OK):**
```json
[
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "station_code": "HYB",
    "station_name": "Hyderabad Deccan",
    "city": "Hyderabad",
    "latitude": 17.392000,
    "longitude": 78.473500
  }
]
```

#### `GET /api/stations/{station_id}`
Returns station by station code (`HYB`, `MAS`, `BZA`) or UUID.

---

### 2.7 Historical Runs API

#### `GET /api/history`
Historical run audit comparing scheduled arrival, actual arrival, travel time, and delay minutes.

**Filters Supported:**
* `train_id` / `train_number`: e.g. `12401`
* `station_id` / `station`: e.g. `BZA`
* `date`: e.g. `2026-09-04`

**Database Mapping:** `historical_runs` JOIN `trains` JOIN `stations`

**Response (200 OK):**
```json
[
  {
    "id": "89d6e64d-c33e-412e-a6dd-54ab1f15ca47",
    "train": "12401 - Demo Express",
    "train_id": "12401",
    "station": "Kazipet Junction",
    "station_code": "KZJ",
    "scheduled_arrival": "20:45",
    "predicted_arrival": "20:45",
    "actual_arrival": "20:50",
    "travel_time": 140,
    "delay": 5,
    "delay_minutes": 5,
    "date": "2026-09-04",
    "status": "MINOR DELAY"
  }
]
```

---

### 2.8 Analytics API

#### `GET /api/analytics`
Dynamically computed operational statistics straight from the database.

**Database Mapping:** Aggregations on `trains`, `stations`, `historical_runs`, `eta_predictions`, `train_positions`

**Response (200 OK):**
```json
{
  "total_trains": 6,
  "active_trains": 6,
  "on_time_trains": 3,
  "delayed_trains": 3,
  "average_delay": 8.0,
  "total_stations": 5,
  "historical_runs": 7,
  "eta_predictions": 2,
  "data_mode": "DEMO / SIMULATED DATA",
  "accuracy_trend": [ ... ],
  "delay_distribution": [ ... ],
  "status_share": [ ... ]
}
```

---

## 3. Database Schema Mapping

| SQL Table | SQLAlchemy Model | Description |
|---|---|---|
| `trains` | `Train` | Express corridors, terminal stations, operational status |
| `stations` | `Station` | Junction nodes with GPS coordinates and IR codes |
| `train_routes` | `TrainRoute` (alias `Route`) | Ordered stops, schedule, distances |
| `train_positions` | `TrainPosition` | Real-time locomotive GPS coordinates, speed, and delay |
| `historical_runs` | `HistoricalRun` (alias `JourneyHistory`) | Historical journey ground truth records |
| `eta_predictions` | `ETAPrediction` | Stored ETA predictions with confidence scores |
| `delay_events` | `DelayEvent` | Signal, congestion, and maintenance delay events |
