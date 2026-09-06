// TrainETA API Service Layer
// Architecture: React Frontend -> FastAPI Backend (/api/trains) -> Supabase PostgreSQL
// Fallback: DEMO_TRAINS (only when backend is offline, network fails, or DB has 0 records)

import {
  DEMO_TRAINS,
  DEMO_HISTORY_LOGS,
  ADMIN_ANALYTICS,
  CORRIDOR_WAYPOINTS,
  CORRIDOR_STATIONS,
} from '../data/demoTrains';

// Base API configuration
const RAW_API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

// Connection state tracking
let apiConnectionStatus = {
  connected: false,
  endpoint: null,
  lastChecked: null,
  error: null,
  dataSource: 'FALLBACK DEMO DATA',
};

export function getApiConnectionStatus() {
  return { ...apiConnectionStatus };
}

/**
 * Resolves potential API endpoints in order of priority:
 * 1. User's configured VITE_API_URL / VITE_API_BASE_URL (if provided and not mixed content)
 * 2. Same-origin relative path '/api' (proxied by Vite to the backend in dev & preview)
 * 3. Local fallback ports 'http://localhost:8000' / 'http://localhost:8001' (if on localhost HTTP)
 */
async function fetchFromApi(path, options = {}) {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const configuredBase = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

  const candidates = [];

  // 1. If configuredBase exists and won't violate HTTPS mixed content
  if (configuredBase) {
    if (!isHttps || configuredBase.startsWith('https:') || configuredBase.startsWith('/')) {
      candidates.push(`${configuredBase}${path}`);
    } else {
      console.warn(
        `[TrainETA API] Skipping insecure VITE_API_URL (${configuredBase}) on HTTPS origin (${typeof window !== 'undefined' ? window.location.origin : 'https'}) to prevent browser Mixed Content block. Using same-origin proxy.`
      );
    }
  }

  // 2. Relative path (proxied by Vite / reverse proxy to FastAPI)
  if (!candidates.includes(path)) {
    candidates.push(path);
  }

  // 3. If running locally on HTTP, also allow explicit localhost:8000 and 8001 as candidates
  if (!isHttps && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    if (!candidates.includes(`http://localhost:8000${path}`)) {
      candidates.push(`http://localhost:8000${path}`);
    }
    if (!candidates.includes(`http://localhost:8001${path}`)) {
      candidates.push(`http://localhost:8001${path}`);
    }
    if (!candidates.includes(`http://127.0.0.1:8000${path}`)) {
      candidates.push(`http://127.0.0.1:8000${path}`);
    }
    if (!candidates.includes(`http://127.0.0.1:8001${path}`)) {
      candidates.push(`http://127.0.0.1:8001${path}`);
    }
  }

  let lastErr = null;

  for (const endpoint of candidates) {
    try {
      const resp = await fetch(endpoint, {
        ...options,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          ...(options.headers || {}),
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        apiConnectionStatus = {
          connected: true,
          endpoint,
          lastChecked: new Date().toISOString(),
          error: null,
          dataSource: 'SUPABASE POSTGRESQL (LIVE)',
        };
        return { data, endpoint };
      }
      lastErr = new Error(`HTTP ${resp.status} (${resp.statusText}) at ${endpoint}`);
    } catch (err) {
      lastErr = err;
    }
  }

  apiConnectionStatus = {
    connected: false,
    endpoint: null,
    lastChecked: new Date().toISOString(),
    error: lastErr ? lastErr.message : 'Unknown network failure',
    dataSource: 'FALLBACK DEMO DATA',
  };

  throw lastErr || new Error(`Could not fetch ${path} from any candidate endpoint`);
}

/**
 * Normalizes backend FastAPI / Supabase train object to match TrainCard and Dashboard UI props
 */
export function mapBackendTrainToFrontend(t, isLive = false) {
  if (!t) return null;

  // Support both backend API schema (snake_case) and fallback demo schema (camelCase)
  // Ensure train_number directly reflects Supabase updates
  const trainNumber = String(t.train_number ?? t.number ?? t.train_id ?? t.id ?? '');
  const trainName = t.train_name ?? t.name ?? `Express ${trainNumber}`;
  const delayMin = Number(t.delay_minutes ?? t.currentDelayMin ?? t.current_delay_minutes ?? 0);

  // Status mapping
  let status = t.status || 'ON TIME';
  if (status === 'ON_TIME') status = 'ON TIME';
  else if (status === 'MINOR_DELAY') status = 'MINOR DELAY';
  else if (status === 'MAJOR_DELAY') status = 'MAJOR DELAY';

  let statusType = t.statusType;
  if (!statusType) {
    if (delayMin === 0 || status === 'ON TIME') statusType = 'ontime';
    else if (delayMin <= 10 || status === 'MINOR DELAY') statusType = 'minor';
    else statusType = 'major';
  }

  // Station formatting
  const sourceCity = t.source || t.source_city || 'Hyderabad';
  const sourceCode = t.source_code || t.sourceStationCode || 'HYB';
  const sourceDisplay = sourceCity.includes('(') ? sourceCity : `${sourceCity} (${sourceCode})`;

  const destCity = t.destination || t.destination_city || 'Chennai';
  const destCode = t.destination_code || t.destinationStationCode || 'MAS';
  const destDisplay = destCity.includes('(') ? destCity : `${destCity} (${destCode})`;

  // Current station & Next station
  const currentStation = t.current_station || t.currentStation || 'Warangal';
  const currentStationCode = t.current_station_code || t.currentStationCode || 'WL';
  const nextStation = t.next_station || t.nextStation || 'Vijayawada';
  const nextStationCode = t.next_station_code || t.nextStationCode || 'BZA';

  // Speeds
  const speed = Number(t.speed ?? t.current_speed ?? t.currentSpeed ?? (delayMin > 0 ? 78 : 88));

  // Scheduled and predicted arrival
  const scheduledArrival = t.scheduled_arrival_at_next || t.scheduledArrivalAtNext || t.scheduled_arrival || '22:36';
  let predictedArrival = t.predicted_arrival_at_next || t.predictedArrivalAtNext || t.predicted_arrival;
  if (!predictedArrival) {
    try {
      const [h, m] = scheduledArrival.split(':').map(Number);
      const totalMin = (h * 60 + m + delayMin) % (24 * 60);
      const ph = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const pm = String(totalMin % 60).padStart(2, '0');
      predictedArrival = `${ph}:${pm}`;
    } catch {
      predictedArrival = '22:42';
    }
  }

  return {
    ...t,
    id: trainNumber, // used for React Router links: /train/:id and /tracking/:id
    db_id: t.id, // preserve database primary key UUID
    train_id: trainNumber,
    number: trainNumber,
    name: trainName,
    train_name: trainName,
    route: `${sourceCity.split(' ')[0]} → ${destCity.split(' ')[0]}`,
    source: sourceDisplay,
    destination: destDisplay,
    source_city: sourceCity,
    source_code: sourceCode,
    destination_city: destCity,
    destination_code: destCode,
    status: status,
    statusType: statusType,
    currentDelayMin: delayMin,
    delay_minutes: delayMin,
    currentSpeed: speed,
    speed: speed,
    currentStation: currentStation,
    currentStationCode: currentStationCode,
    nextStation: nextStation,
    nextStationCode: nextStationCode,
    scheduledArrivalAtNext: scheduledArrival,
    predictedArrivalAtNext: predictedArrival,
    currentCoords: t.currentCoords || (t.latitude && t.longitude ? { lat: Number(t.latitude), lng: Number(t.longitude) } : { lat: 17.9689, lng: 79.5941 }),
    predictionConfidence: t.predictionConfidence ?? (t.confidence ? Math.round(t.confidence * 100) : 88),
    predictionType: t.prediction_type || t.predictionType || 'BASELINE',
    baselineEta: t.baseline_eta || t.baselineEta || null,
    baselineDelay: t.baseline_delay !== undefined ? t.baseline_delay : (t.baselineDelay ?? null),
    isLive: Boolean(isLive),
  };
}

// In-memory simulation state copy
let liveTrains = DEMO_TRAINS.map((t) => mapBackendTrainToFrontend(t, false));

export const trainApi = {
  /**
   * Fetch all currently monitored trains from FastAPI (/api/trains)
   * Primary source: FastAPI backend connected to Supabase PostgreSQL
   * Fallback source: DEMO_TRAINS (only if backend is unavailable, network fails, or DB has 0 records)
   */
  async getTrains() {
    try {
      const { data, endpoint } = await fetchFromApi('/api/trains');

      if (Array.isArray(data) && data.length > 0) {
        console.log(
          `[TrainETA API] SUCCESS: Loaded ${data.length} trains from FastAPI (${endpoint}). Data source: SUPABASE POSTGRESQL (LIVE).`
        );
        const mapped = data.map((t) => mapBackendTrainToFrontend(t, true));
        liveTrains = mapped;
        return mapped;
      }

      console.warn(
        `[TrainETA API] Backend returned 0 train records. Fallback data being used (${DEMO_TRAINS.length} trains). Data source: FALLBACK DEMO DATA.`
      );
      return DEMO_TRAINS.map((t) => mapBackendTrainToFrontend(t, false));
    } catch (err) {
      console.warn(
        `[TrainETA API] Backend request failed (${err.message}). Fallback data being used (${DEMO_TRAINS.length} trains). Data source: FALLBACK DEMO DATA.`
      );
      return DEMO_TRAINS.map((t) => mapBackendTrainToFrontend(t, false));
    }
  },

  /**
   * Get single train details by ID or train number
   */
  async getTrainById(id) {
    try {
      const { data, endpoint } = await fetchFromApi(`/api/trains/${encodeURIComponent(id)}`);
      if (data) {
        console.log(
          `[TrainETA API] SUCCESS: Train details received for #${id} from FastAPI (${endpoint}). Data source: SUPABASE POSTGRESQL (LIVE).`
        );
        
        // Fetch ML ETA prediction
        let etaData = null;
        try {
          const etaRes = await fetchFromApi(`/api/trains/${encodeURIComponent(id)}/eta`);
          etaData = etaRes.data;
        } catch (etaErr) {
          console.warn(`[TrainETA API] Could not fetch ETA for #${id}: ${etaErr.message}`);
        }
        
        if (etaData) {
          data.predicted_arrival = etaData.predicted_eta;
          data.confidence = etaData.confidence;
          data.prediction_type = etaData.prediction_type;
          data.baseline_eta = etaData.baseline_eta;
          data.baseline_delay = etaData.baseline_delay;
          data.scheduled_arrival = etaData.scheduled_eta;
        }

        return mapBackendTrainToFrontend(data, true);
      }
    } catch (err) {
      console.warn(`[TrainETA API] getTrainById for #${id} failed (${err.message}). Using fallback.`);
    }

    const fallback =
      liveTrains.find((t) => String(t.id) === String(id) || String(t.number) === String(id)) ||
      DEMO_TRAINS.find((t) => String(t.id) === String(id) || String(t.number) === String(id)) ||
      DEMO_TRAINS[0];
    return mapBackendTrainToFrontend(fallback, false);
  },

  /**
   * Search trains by number, name, station, or status
   */
  async searchTrains(searchTerm = '', filters = {}) {
    const params = new URLSearchParams();
    if (searchTerm && searchTerm.trim()) params.append('q', searchTerm.trim());
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.source && filters.source !== 'all') params.append('source', filters.source);
    if (filters.destination && filters.destination !== 'all') params.append('destination', filters.destination);

    const queryStr = params.toString();
    const path = `/api/trains/search${queryStr ? `?${queryStr}` : ''}`;

    try {
      const { data, endpoint } = await fetchFromApi(path);
      if (Array.isArray(data) && data.length > 0) {
        console.log(
          `[TrainETA API] SUCCESS: ${data.length} trains found from FastAPI search (${endpoint}). Data source: SUPABASE POSTGRESQL (LIVE).`
        );
        return data.map((t) => mapBackendTrainToFrontend(t, true));
      }
    } catch (err) {
      console.warn(`[TrainETA API] searchTrains failed (${err.message}). Using local filter fallback.`);
    }

    // Fallback: local filter
    const term = searchTerm.trim().toLowerCase();
    const list = liveTrains.length > 0 ? liveTrains : DEMO_TRAINS;
    return list.filter((train) => {
      const matchText =
        !term ||
        train.number.toLowerCase().includes(term) ||
        train.name.toLowerCase().includes(term) ||
        train.route.toLowerCase().includes(term) ||
        (train.currentStation && train.currentStation.toLowerCase().includes(term));

      const matchStatus = !filters.status || train.statusType === filters.status;
      const matchSource = !filters.source || train.source.includes(filters.source);
      const matchDest = !filters.destination || train.destination.includes(filters.destination);

      return matchText && matchStatus && matchSource && matchDest;
    }).map((t) => mapBackendTrainToFrontend(t, false));
  },

  /**
   * Fetch historical prediction vs actual arrival records
   */
  async getHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.trainNumber && filters.trainNumber !== 'all') params.append('train_id', filters.trainNumber);
    if (filters.station && filters.station !== 'all') params.append('station', filters.station);
    if (filters.limit) params.append('limit', String(filters.limit));

    const path = `/api/history${params.toString() ? `?${params.toString()}` : ''}`;
    try {
      const { data } = await fetchFromApi(path);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }

    let logs = [...DEMO_HISTORY_LOGS];
    if (filters.search) {
      const term = filters.search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.trainNumber.toLowerCase().includes(term) ||
          l.trainName.toLowerCase().includes(term) ||
          l.station.toLowerCase().includes(term)
      );
    }
    if (filters.trainNumber && filters.trainNumber !== 'all') {
      logs = logs.filter((l) => l.trainNumber === filters.trainNumber);
    }
    if (filters.station && filters.station !== 'all') {
      logs = logs.filter((l) => l.stationCode === filters.station || l.station === filters.station);
    }
    if (filters.date) {
      logs = logs.filter((l) => l.date === filters.date);
    }

    return logs;
  },

  /**
   * Fetch system operations and ML accuracy analytics
   */
  async getAdminAnalytics() {
    try {
      const { data } = await fetchFromApi('/api/analytics');
      if (data) return data;
    } catch {
      // Fallback
    }
    return JSON.parse(JSON.stringify(ADMIN_ANALYTICS));
  },

  /**
   * Get all fixed corridor stations
   */
  async getCorridorStations() {
    try {
      const { data } = await fetchFromApi('/api/stations');
      if (Array.isArray(data) && data.length > 0) {
        return data.map((s, idx) => ({
          id: s.id,
          name: s.station_name,
          code: s.station_code,
          city: s.city,
          kmFromOrigin: idx * 85,
          coords: { lat: 17.3850 + idx * 0.5, lng: 78.4867 + idx * 0.4 },
        }));
      }
    } catch {
      // Fallback
    }
    return JSON.parse(JSON.stringify(CORRIDOR_STATIONS));
  },

  /**
   * Simulate train movement step along the corridor waypoints
   * Now integrates with FastAPI backend to update positions in DB
   */
  async simulateStep(trainId) {
    try {
      const { data } = await fetchFromApi(`/api/trains/${encodeURIComponent(trainId)}/simulate_step`);
      if (data) {
        // We still need to fetch ETA info because get_train_details might not have the full ML ETA format,
        // Actually getTrainById combines both. Let's just use getTrainById to return the full rich object.
        return this.getTrainById(trainId);
      }
    } catch (err) {
      console.warn(`[TrainETA API] Backend simulate_step failed for #${trainId}: ${err.message}. Using fallback.`);
    }

    // Fallback logic
    const trainIndex = liveTrains.findIndex((t) => String(t.id) === String(trainId) || String(t.number) === String(trainId));
    if (trainIndex === -1) return null;

    const train = liveTrains[trainIndex];
    let nextIndex = ((train.waypointIndex || 0) + 1) % CORRIDOR_WAYPOINTS.length;

    train.waypointIndex = nextIndex;
    const targetWaypoint = CORRIDOR_WAYPOINTS[nextIndex];
    train.currentCoords = { lat: targetWaypoint.lat, lng: targetWaypoint.lng };

    const speedVariation = (Math.random() - 0.48) * 4;
    train.currentSpeed = Math.min(105, Math.max(55, Math.round((train.currentSpeed || 78) + speedVariation)));

    if (Math.random() > 0.8) {
      const delayDelta = Math.random() > 0.6 ? 1 : -1;
      train.currentDelayMin = Math.max(0, (train.currentDelayMin || 0) + delayDelta);
      if (train.currentDelayMin === 0) {
        train.status = 'ON TIME';
        train.statusType = 'ontime';
      } else if (train.currentDelayMin <= 10) {
        train.status = 'MINOR DELAY';
        train.statusType = 'minor';
      } else {
        train.status = 'MAJOR DELAY';
        train.statusType = 'major';
      }
    }

    return JSON.parse(JSON.stringify(train));
  },

  /**
   * Reset simulation state back to original demo values
   */
  resetSimulation() {
    liveTrains = DEMO_TRAINS.map((t) => mapBackendTrainToFrontend(t, false));
    return JSON.parse(JSON.stringify(liveTrains));
  },
};
