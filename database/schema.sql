-- ==============================================================================
-- TrainETA: Dynamic Railway Intelligence Platform
-- Supabase PostgreSQL Schema Definition
-- ==============================================================================
-- Notice: Contains DEMO / SIMULATED railway telemetry data.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables/views if recreating
DROP VIEW IF EXISTS routes CASCADE;
DROP VIEW IF EXISTS journey_history CASCADE;
DROP TABLE IF EXISTS delay_events CASCADE;
DROP TABLE IF EXISTS eta_predictions CASCADE;
DROP TABLE IF EXISTS historical_runs CASCADE;
DROP TABLE IF EXISTS train_positions CASCADE;
DROP TABLE IF EXISTS train_routes CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS trains CASCADE;
DROP TABLE IF EXISTS stations CASCADE;

-- ------------------------------------------------------------------------------
-- 1. STATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code VARCHAR(10) UNIQUE NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. TRAINS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_number VARCHAR(10) UNIQUE NOT NULL,
    train_name VARCHAR(100) NOT NULL,
    source_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    destination_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'ON_TIME', -- ON_TIME, MINOR_DELAY, MAJOR_DELAY
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TRAIN_ROUTES TABLE
-- Defines the ordered journey stations for each train
-- ------------------------------------------------------------------------------
CREATE TABLE train_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
    sequence_number INT NOT NULL,
    scheduled_arrival TIME,
    scheduled_departure TIME,
    distance_from_source NUMERIC(7, 2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_train_sequence UNIQUE (train_id, sequence_number),
    CONSTRAINT uq_train_station UNIQUE (train_id, station_id)
);

-- Backward compatibility view
CREATE OR REPLACE VIEW routes AS SELECT * FROM train_routes;

-- ------------------------------------------------------------------------------
-- 4. TRAIN_POSITIONS TABLE
-- Supports live and simulated real-time tracking along the corridor
-- ------------------------------------------------------------------------------
CREATE TABLE train_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    speed INT DEFAULT 0,
    current_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    next_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    current_delay_minutes INT DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. HISTORICAL_RUNS TABLE
-- Historical audit logs for schedule performance & ML model validation
-- ------------------------------------------------------------------------------
CREATE TABLE historical_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
    scheduled_arrival TIME NOT NULL,
    actual_arrival TIME NOT NULL,
    travel_time_minutes INT DEFAULT 0,
    delay_minutes INT DEFAULT 0,
    journey_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward compatibility view
CREATE OR REPLACE VIEW journey_history AS SELECT * FROM historical_runs;

-- ------------------------------------------------------------------------------
-- 6. ETA_PREDICTIONS TABLE
-- Prepares the system for ML/heuristic ETA predictions per station milestone
-- ------------------------------------------------------------------------------
CREATE TABLE eta_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    scheduled_eta TIMESTAMPTZ NOT NULL,
    predicted_eta TIMESTAMPTZ NOT NULL,
    predicted_delay_minutes INT DEFAULT 0,
    confidence NUMERIC(4, 2) DEFAULT 0.75,
    prediction_type VARCHAR(50) DEFAULT 'BASELINE',
    model_version VARCHAR(50) DEFAULT 'v1-baseline',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. DELAY_EVENTS TABLE
-- Operational logs of delays caused by signals, crossings, or weather
-- ------------------------------------------------------------------------------
CREATE TABLE delay_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    delay_minutes INT NOT NULL DEFAULT 0,
    reason VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL DEFAULT 'SIGNAL', -- SIGNAL, WEATHER, CONGESTION, TECHNICAL, CROSSING
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX idx_trains_number ON trains(train_number);
CREATE INDEX idx_stations_code ON stations(station_code);
CREATE INDEX idx_train_routes_train_seq ON train_routes(train_id, sequence_number);
CREATE INDEX idx_train_positions_train_recorded ON train_positions(train_id, recorded_at DESC);
CREATE INDEX idx_eta_predictions_train_station ON eta_predictions(train_id, station_id);
CREATE INDEX idx_historical_runs_train ON historical_runs(train_id, journey_date);
CREATE INDEX idx_delay_events_train ON delay_events(train_id, recorded_at DESC);
