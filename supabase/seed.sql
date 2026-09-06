-- ==============================================================================
-- TrainETA: Dynamic Railway Intelligence Platform
-- Supabase PostgreSQL Seed Data
-- ==============================================================================
-- Notice: Contains realistic Indian Railways corridor DEMO / SIMULATED data.
-- Corridor: Hyderabad Deccan (HYB) ⇄ Chennai Central (MAS)
-- ==============================================================================

-- 1. Insert Stations
INSERT INTO stations (id, station_code, station_name, city, latitude, longitude)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'HYB', 'Hyderabad Deccan', 'Hyderabad', 17.392000, 78.473500),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'KZJ', 'Kazipet Junction', 'Kazipet', 17.978400, 79.516700),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'WL',  'Warangal', 'Warangal', 17.968900, 79.594100),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'BZA', 'Vijayawada Junction', 'Vijayawada', 16.518600, 80.619500),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'MAS', 'Chennai Central', 'Chennai', 13.082700, 80.270700)
ON CONFLICT (station_code) DO UPDATE SET
  station_name = EXCLUDED.station_name,
  city = EXCLUDED.city,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- 2. Insert Trains
INSERT INTO trains (id, train_number, train_name, source_station_id, destination_station_id, status)
VALUES
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
    '12401',
    'Demo Express',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', -- MAS
    'MINOR_DELAY'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
    '12605',
    'South Corridor Express',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', -- MAS
    'ON_TIME'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03',
    '12760',
    'Coastal Superfast',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', -- MAS
    'MAJOR_DELAY'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04',
    '12728',
    'Godavari Superfast',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', -- BZA
    'ON_TIME'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05',
    '12704',
    'Faluknama Express',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', -- MAS
    'MINOR_DELAY'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06',
    '12616',
    'Grand Trunk Express',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', -- MAS
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    'ON_TIME'
  )
ON CONFLICT (train_number) DO UPDATE SET
  train_name = EXCLUDED.train_name,
  status = EXCLUDED.status;

-- 3. Insert Train Routes (Train 12401 Demo Express: HYB -> KZJ -> WL -> BZA -> MAS)
INSERT INTO train_routes (train_id, station_id, sequence_number, scheduled_arrival, scheduled_departure, distance_from_source)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, NULL, '18:30:00', 0.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 2, '20:45:00', '20:50:00', 132.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 3, '21:05:00', '21:10:00', 142.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 4, '22:36:00', '22:45:00', 349.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 5, '05:45:00', NULL, 695.0)
ON CONFLICT (train_id, sequence_number) DO UPDATE SET
  scheduled_arrival = EXCLUDED.scheduled_arrival,
  scheduled_departure = EXCLUDED.scheduled_departure,
  distance_from_source = EXCLUDED.distance_from_source;

-- Insert Routes for Train 12605 South Corridor Express
INSERT INTO train_routes (train_id, station_id, sequence_number, scheduled_arrival, scheduled_departure, distance_from_source)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, NULL, '19:15:00', 0.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 2, '21:20:00', '21:25:00', 132.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 3, '21:40:00', '21:45:00', 142.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 4, '23:10:00', '23:20:00', 349.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 5, '06:30:00', NULL, 695.0)
ON CONFLICT (train_id, sequence_number) DO UPDATE SET
  scheduled_arrival = EXCLUDED.scheduled_arrival,
  scheduled_departure = EXCLUDED.scheduled_departure,
  distance_from_source = EXCLUDED.distance_from_source;

-- Insert Routes for Train 12760 Coastal Superfast
INSERT INTO train_routes (train_id, station_id, sequence_number, scheduled_arrival, scheduled_departure, distance_from_source)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, NULL, '16:00:00', 0.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 2, '18:10:00', '18:15:00', 132.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 3, '18:35:00', '18:40:00', 142.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 4, '20:40:00', '20:50:00', 349.0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 5, '03:45:00', NULL, 695.0)
ON CONFLICT (train_id, sequence_number) DO UPDATE SET
  scheduled_arrival = EXCLUDED.scheduled_arrival,
  scheduled_departure = EXCLUDED.scheduled_departure,
  distance_from_source = EXCLUDED.distance_from_source;

-- 4. Insert Live / Simulated Positions
INSERT INTO train_positions (train_id, latitude, longitude, speed, current_station_id, next_station_id, current_delay_minutes, recorded_at)
VALUES
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', -- 12401 Demo Express
    17.968900,
    79.594100,
    78,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', -- Warangal (WL)
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', -- Vijayawada (BZA)
    6,
    NOW()
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', -- 12605 South Corridor
    17.978400,
    79.516700,
    88,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', -- Kazipet (KZJ)
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', -- Warangal (WL)
    0,
    NOW()
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', -- 12760 Coastal Superfast
    17.392000,
    78.473500,
    42,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Hyderabad (HYB)
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', -- Kazipet (KZJ)
    18,
    NOW()
  );

-- 5. Insert ETA Predictions
INSERT INTO eta_predictions (train_id, station_id, scheduled_eta, predicted_eta, predicted_delay_minutes, confidence, prediction_type, model_version)
VALUES
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', -- BZA
    NOW() + INTERVAL '1 hour 30 minutes',
    NOW() + INTERVAL '1 hour 36 minutes',
    6,
    0.75,
    'BASELINE',
    'v1-baseline'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', -- MAS
    NOW() + INTERVAL '8 hours 40 minutes',
    NOW() + INTERVAL '8 hours 46 minutes',
    6,
    0.70,
    'BASELINE',
    'v1-baseline'
  );

-- 6. Insert Historical Runs
INSERT INTO historical_runs (train_id, station_id, scheduled_arrival, actual_arrival, travel_time_minutes, delay_minutes, journey_date)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '20:45:00', '20:50:00', 140, 5, CURRENT_DATE - INTERVAL '1 day'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '21:05:00', '21:11:00', 161, 6, CURRENT_DATE - INTERVAL '1 day'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', '22:36:00', '22:42:00', 252, 6, CURRENT_DATE - INTERVAL '1 day'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', '05:45:00', '05:50:00', 680, 5, CURRENT_DATE - INTERVAL '1 day'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '21:20:00', '21:19:00', 124, 0, CURRENT_DATE - INTERVAL '2 days'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '21:40:00', '21:40:00', 145, 0, CURRENT_DATE - INTERVAL '2 days'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', '20:40:00', '20:58:00', 298, 18, CURRENT_DATE - INTERVAL '3 days');

-- 7. Insert Delay Events
INSERT INTO delay_events (train_id, station_id, delay_minutes, reason, event_type, recorded_at)
VALUES
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', -- WL
    6,
    'Signal waiting clearance at Warangal outer yard',
    'SIGNAL',
    NOW() - INTERVAL '15 minutes'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- HYB
    18,
    'Platform congestion during departure peak',
    'CONGESTION',
    NOW() - INTERVAL '40 minutes'
  );
