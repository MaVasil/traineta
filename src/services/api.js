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
 * Resolves API endpoints:
 * 1. User's configured VITE_API_URL / VITE_API_BASE_URL (if provided and not mixed content)
 * 2. Same-origin relative path '/api' (proxied by Vite to the backend in dev & preview)
 */
async function fetchFromApi(path, options = {}) {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const configuredBase = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

  const endpoints = [];
  if (configuredBase) {
    if (!isHttps || configuredBase.startsWith('https:') || configuredBase.startsWith('/')) {
      endpoints.push(`${configuredBase}${path}`);
    } else {
      console.warn(
        `[TrainETA API] Skipping insecure VITE_API_URL (${configuredBase}) on HTTPS origin (${typeof window !== 'undefined' ? window.location.origin : 'https'}) to prevent browser Mixed Content block. Using same-origin proxy.`
      );
    }
  }
  if (!endpoints.includes(path)) {
    endpoints.push(path);
  }

  let lastErr = null;
  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
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
          endpoint: ep,
          lastChecked: new Date().toISOString(),
          error: null,
          dataSource: 'SUPABASE POSTGRESQL (LIVE)',
        };
        return { data, endpoint: ep };
      }
      lastErr = new Error(`HTTP ${resp.status} (${resp.statusText}) at ${ep}`);
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
  throw lastErr;
}

/**
 * Validates latitude and longitude coordinates.
 * Strictly rejects null, undefined, NaN, and (0, 0) Null Island.
 */
export function isValidCoordinate(lat, lng) {
  if (lat == null || lng == null) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng)) return false;
  if (nLat === 0 && nLng === 0) return false;
  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) return false;
  return true;
}

/**
 * Normalizes coordinate pair [c1, c2] or (lat, lng) into { lat, lng }.
 * Detects and handles GeoJSON [longitude, latitude] coordinate inversion.
 * In India: Latitude is ~8° to 38° N, Longitude is ~68° to 98° E.
 */
export function parseCoordinatePair(c1, c2) {
  if (c1 == null || c2 == null) return null;
  const n1 = Number(c1);
  const n2 = Number(c2);
  if (isNaN(n1) || isNaN(n2)) return null;
  if (n1 === 0 && n2 === 0) return null;

  let lat, lng;
  if (n1 > 50 && n2 >= -45 && n2 <= 45) {
    // n1 is longitude, n2 is latitude (GeoJSON [lng, lat])
    lat = n2;
    lng = n1;
  } else if (n1 >= -90 && n1 <= 90 && n2 >= -180 && n2 <= 180) {
    // standard [lat, lng]
    lat = n1;
    lng = n2;
  } else if (n2 >= -90 && n2 <= 90 && n1 >= -180 && n1 <= 180) {
    lat = n2;
    lng = n1;
  } else {
    return null;
  }

  if (isValidCoordinate(lat, lng)) {
    return { lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) };
  }
  return null;
}

/**
 * Normalizes backend FastAPI / Supabase train object to match TrainCard, TrainMap, and Dashboard UI props
 */
export function mapBackendTrainToFrontend(t, isLive = false) {
  if (!t) return null;

  // Support both backend API schema (snake_case) and fallback demo schema (camelCase)
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

  // Station formatting - Canonical Origin and Terminus Endpoints
  const rawSrcObj = (t.source_details && typeof t.source_details === 'object') ? t.source_details : (typeof t.source === 'object' ? t.source : {});
  const sourceCode = String(rawSrcObj.code || t.source_code || t.sourceStationCode || t.stations?.[0]?.code || t.timeline?.[0]?.code || 'SRC').toUpperCase();
  const sourceName = rawSrcObj.name || t.source_name || (typeof t.source === 'string' && t.source !== 'Unknown' ? t.source : null) || t.source_city || t.stations?.[0]?.name || t.timeline?.[0]?.name || sourceCode;
  const sLat = rawSrcObj.latitude ?? rawSrcObj.lat ?? t.source_latitude ?? t.source_lat ?? t.stations?.[0]?.lat;
  const sLng = rawSrcObj.longitude ?? rawSrcObj.lng ?? t.source_longitude ?? t.source_lng ?? t.stations?.[0]?.lng;
  const sourceCoords = parseCoordinatePair(sLat, sLng);
  const sourceObj = {
    code: sourceCode,
    name: sourceName,
    latitude: sourceCoords ? sourceCoords.lat : null,
    longitude: sourceCoords ? sourceCoords.lng : null,
  };

  const lastSt = (Array.isArray(t.stations) && t.stations.length > 0)
    ? t.stations[t.stations.length - 1]
    : ((Array.isArray(t.timeline) && t.timeline.length > 0) ? t.timeline[t.timeline.length - 1] : null);
  const rawDstObj = (t.destination_details && typeof t.destination_details === 'object') ? t.destination_details : (typeof t.destination === 'object' ? t.destination : {});
  const destCode = String(rawDstObj.code || t.destination_code || t.destinationStationCode || lastSt?.code || 'DST').toUpperCase();
  const destName = rawDstObj.name || t.destination_name || (typeof t.destination === 'string' && t.destination !== 'Unknown' ? t.destination : null) || t.destination_city || lastSt?.name || destCode;
  const dLat = rawDstObj.latitude ?? rawDstObj.lat ?? t.destination_latitude ?? t.destination_lat ?? lastSt?.lat;
  const dLng = rawDstObj.longitude ?? rawDstObj.lng ?? t.destination_longitude ?? t.destination_lng ?? lastSt?.lng;
  const destCoords = parseCoordinatePair(dLat, dLng);
  const destinationObj = {
    code: destCode,
    name: destName,
    latitude: destCoords ? destCoords.lat : null,
    longitude: destCoords ? destCoords.lng : null,
  };

  const sourceDisplay = sourceName.includes('(') ? sourceName : (sourceCode && sourceCode !== 'SRC' ? `${sourceName} (${sourceCode})` : sourceName);
  const destDisplay = destName.includes('(') ? destName : (destCode && destCode !== 'DST' ? `${destName} (${destCode})` : destName);

  // Current station & Next station
  const currentStation = t.current_station || t.currentStation || 'In Transit';
  const currentStationCode = t.current_station_code || t.currentStationCode || 'TRN';
  const nextStation = t.next_station || t.nextStation || 'Approaching';
  const nextStationCode = t.next_station_code || t.nextStationCode || 'APR';

  // Dynamic Speeds
  const speed = t.speed != null ? Number(t.speed) : (t.speed_kmph != null ? Number(t.speed_kmph) : (t.currentSpeed != null ? Number(t.currentSpeed) : (t.current_speed != null ? Number(t.current_speed) : null)));
  const speedUnit = t.speed_unit || t.speedUnit || 'km/h';

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

  // Strict coordinate resolution with GeoJSON inversion detection
  const rawLat = t.latitude ?? t.currentCoords?.lat ?? t.current_position?.latitude;
  const rawLng = t.longitude ?? t.currentCoords?.lng ?? t.current_position?.longitude;
  const coords = parseCoordinatePair(rawLat, rawLng);

  const rawStLat = t.station_latitude ?? t.station_position?.latitude ?? t.stationCoords?.lat;
  const rawStLng = t.station_longitude ?? t.station_position?.longitude ?? t.stationCoords?.lng;
  const stationCoords = parseCoordinatePair(rawStLat, rawStLng);

  const locationType = t.location_type || (coords ? 'GPS' : (stationCoords ? 'STATION' : 'NONE'));

  const dataSource = t.data_source || t.dataSource || 'SIMULATED';
  const dataStatus = t.data_status || t.dataStatus || 'LIVE';

  // Route Station Timeline mapping from real halts
  const rawTimeline = Array.isArray(t.timeline) && t.timeline.length > 0 
    ? t.timeline 
    : (Array.isArray(t.halts) && t.halts.length > 0 ? t.halts : []);

  const timeline = rawTimeline.map((item, idx) => {
    const code = String(item.station_code || item.code || item.stationCode || '').toUpperCase();
    const name = item.station_name || item.name || item.stationName || code;
    const isHalt = item.is_halt !== undefined ? Boolean(item.is_halt) : (item.isHalt !== undefined ? Boolean(item.isHalt) : true);
    
    let state = (item.state || '').toLowerCase();
    const statusUpper = (item.status || '').toUpperCase();
    if (!state) {
      if (statusUpper === 'CURRENT' || (currentStationCode && code === currentStationCode.toUpperCase())) state = 'current';
      else if (statusUpper === 'NEXT' || (nextStationCode && code === nextStationCode.toUpperCase())) state = 'next';
      else if (statusUpper === 'COMPLETED' || statusUpper === 'DEPARTED') state = 'completed';
      else state = 'upcoming';
    }

    const schArr = item.scheduled_arrival || item.scheduledArr || item.scheduledArrival || '--';
    const schDep = item.scheduled_departure || item.scheduledDep || item.scheduledDeparture || '--';
    const actArr = item.actual_arrival || item.actualArr || item.actualArrival || '--';
    const actDep = item.actual_departure || item.actualDep || item.actualDeparture || '--';

    const itemLat = item.latitude ?? item.lat;
    const itemLng = item.longitude ?? item.lng;
    const itemValidCoords = parseCoordinatePair(itemLat, itemLng);

    return {
      sequence: item.sequence != null ? Number(item.sequence) : idx + 1,
      code,
      station_code: code,
      name,
      station_name: name,
      latitude: itemValidCoords ? itemValidCoords.lat : null,
      longitude: itemValidCoords ? itemValidCoords.lng : null,
      lat: itemValidCoords ? itemValidCoords.lat : null,
      lng: itemValidCoords ? itemValidCoords.lng : null,
      isHalt,
      is_halt: isHalt,
      status: statusUpper || state.toUpperCase(),
      state,
      scheduledArr: schArr,
      scheduled_arrival: schArr !== '--' ? schArr : null,
      scheduledDep: schDep,
      scheduled_departure: schDep !== '--' ? schDep : null,
      actualArr: actArr,
      actual_arrival: actArr !== '--' ? actArr : null,
      actualDep: actDep,
      actual_departure: actDep !== '--' ? actDep : null,
      platform: item.platform || null,
      delayMin: item.delay_minutes ?? item.delayMin ?? 0,
      delay_minutes: item.delay_minutes ?? item.delayMin ?? 0,
      distance: item.distance != null ? Number(item.distance) : 0,
      distance_from_source: item.distance != null ? Number(item.distance) : 0,
      dataSource: item.data_source || dataSource,
    };
  });

  // Track geometry coordinates mapping for polyline
  const rawRouteCoords = Array.isArray(t.route_coordinates)
    ? t.route_coordinates
    : (Array.isArray(t.routeCoordinates) ? t.routeCoordinates : []);

  const routeCoordinates = rawRouteCoords
    .map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        return parseCoordinatePair(pt[0], pt[1]);
      } else if (pt && typeof pt === 'object' && 'lat' in pt && 'lng' in pt) {
        return parseCoordinatePair(pt.lat, pt.lng);
      }
      return null;
    })
    .filter(Boolean);

  // Normalized stations for map markers
  const rawStations = Array.isArray(t.stations) && t.stations.length > 0
    ? t.stations
    : timeline;

  const stations = rawStations.map((st, idx) => {
    const code = String(st.station_code || st.code || st.stationCode || '').toUpperCase();
    const name = st.station_name || st.name || st.stationName || code;
    const sLat = st.latitude ?? st.lat;
    const sLng = st.longitude ?? st.lng;
    const validStationCoord = parseCoordinatePair(sLat, sLng);
    const isPassed = st.state === 'completed' || st.status === 'COMPLETED' || st.status === 'DEPARTED';
    const isCurrent = (currentStationCode && code === currentStationCode.toUpperCase()) || st.state === 'current' || st.status === 'CURRENT';
    const isNext = (nextStationCode && code === nextStationCode.toUpperCase()) || st.state === 'next' || st.status === 'NEXT';

    return {
      sequence: st.sequence != null ? Number(st.sequence) : idx + 1,
      code,
      station_code: code,
      name,
      station_name: name,
      lat: validStationCoord ? validStationCoord.lat : null,
      lng: validStationCoord ? validStationCoord.lng : null,
      latitude: validStationCoord ? validStationCoord.lat : null,
      longitude: validStationCoord ? validStationCoord.lng : null,
      isPassed,
      isCurrent,
      isNext,
      isHalt: st.is_halt !== undefined ? Boolean(st.is_halt) : (st.isHalt !== undefined ? Boolean(st.isHalt) : true),
      distanceKm: st.distance != null ? Number(st.distance) : (st.distance_from_source != null ? Number(st.distance_from_source) : 0),
      delayMin: st.delay_minutes ?? st.delayMin ?? 0,
      scheduledArr: st.scheduled_arrival || st.scheduledArr || '--',
      scheduledDep: st.scheduled_departure || st.scheduledDep || '--',
      actualArr: st.actual_arrival || st.actualArr || '--',
      actualDep: st.actual_departure || st.actualDep || '--',
    };
  });

  return {
    ...t,
    id: trainNumber, // used for React Router links: /train/:id and /tracking/:id
    db_id: t.id, // preserve database primary key UUID
    train_id: trainNumber,
    number: trainNumber,
    name: trainName,
    train_name: trainName,
    route: `${sourceName.split(' ')[0]} → ${destName.split(' ')[0]}`,
    source: sourceDisplay,
    source_station: sourceName,
    sourceName: sourceName,
    sourceCode: sourceCode,
    source_code: sourceCode,
    sourceObj: sourceObj,
    sourceDetails: sourceObj,
    source_details: sourceObj,
    destination: destDisplay,
    destination_station: destName,
    destinationName: destName,
    destCode: destCode,
    destination_code: destCode,
    destObj: destinationObj,
    destinationDetails: destinationObj,
    destination_details: destinationObj,
    source_city: sourceName,
    destination_city: destName,
    status: status,
    statusType: statusType,
    currentDelayMin: delayMin,
    delay_minutes: delayMin,
    currentSpeed: speed,
    speed: speed,
    speedStatus: t.speed_status || t.speedStatus || (speed != null ? 'LIVE' : 'UNAVAILABLE'),
    speed_status: t.speed_status || t.speedStatus || (speed != null ? 'LIVE' : 'UNAVAILABLE'),
    speedUnit: speedUnit,
    speed_unit: speedUnit,
    currentStation: currentStation,
    currentStationCode: currentStationCode,
    nextStation: nextStation,
    nextStationCode: nextStationCode,
    scheduledArrivalAtNext: scheduledArrival,
    predictedArrivalAtNext: predictedArrival,
    currentCoords: coords,
    stationCoords: stationCoords,
    latitude: coords ? coords.lat : null,
    longitude: coords ? coords.lng : null,
    locationType: locationType,
    location_type: locationType,
    routeCoordinates: routeCoordinates,
    route_coordinates: routeCoordinates,
    stations: stations,
    timeline: timeline,
    halts: timeline,
    dataSource: dataSource,
    dataStatus: dataStatus,
    lastUpdated: t.timestamp || t.recorded_at || null,
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
   * Fetch full geospatial map payload for Google Maps / Leaflet
   */
  async getTrainMap(trainId) {
    const cleanId = String(trainId || '').trim();
    if (!cleanId) return null;
    try {
      const { data } = await fetchFromApi(`/api/trains/${encodeURIComponent(cleanId)}/map`);
      return data;
    } catch (err) {
      console.warn(`[TrainETA API] getTrainMap failed for #${cleanId}: ${err.message}`);
      return null;
    }
  },

  /**
   * Fetch train route and track geometry
   */
  async getTrainRoute(trainId) {
    const cleanId = String(trainId || '').trim();
    if (!cleanId) return null;
    try {
      const { data } = await fetchFromApi(`/api/trains/${encodeURIComponent(cleanId)}/route`);
      return data;
    } catch (err) {
      console.warn(`[TrainETA API] getTrainRoute failed for #${cleanId}: ${err.message}`);
      return null;
    }
  },

  /**
   * Fetch route station timeline for a train
   */
  async getTrainTimeline(trainId) {
    const cleanId = String(trainId || '').trim();
    if (!cleanId) return null;
    try {
      const { data } = await fetchFromApi(`/api/trains/${encodeURIComponent(cleanId)}/timeline`);
      return data;
    } catch (err) {
      console.warn(`[TrainETA API] getTrainTimeline failed for #${cleanId}: ${err.message}`);
      return null;
    }
  },

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
   * Dynamically discover and register a train by train number from live railway network (RailRadar)
   */
  async discoverTrain(trainNumber) {
    const cleanNum = String(trainNumber).trim();
    if (!cleanNum) return null;
    try {
      const { data } = await fetchFromApi(`/api/trains/discover/${encodeURIComponent(cleanNum)}`);
      if (data && data.success && data.train) {
        console.log(`[TrainETA API] Dynamic discovery successful for train #${cleanNum}`);
        const mapped = mapBackendTrainToFrontend(data.train, true);
        const idx = liveTrains.findIndex((t) => String(t.id) === String(cleanNum) || String(t.number) === String(cleanNum));
        if (idx !== -1) {
          liveTrains[idx] = mapped;
        } else {
          liveTrains.push(mapped);
        }
        return mapped;
      }
    } catch (err) {
      console.warn(`[TrainETA API] discoverTrain failed for #${cleanNum}: ${err.message}`);
    }
    return null;
  },

  /**
   * Get single train details by ID or train number
   */
  async getTrainById(id) {
    const cleanId = String(id || '').trim();
    if (!cleanId) return null;

    try {
      const { data, endpoint } = await fetchFromApi(`/api/trains/${encodeURIComponent(cleanId)}`);
      if (data) {
        console.log(
          `[TrainETA API] SUCCESS: Train details received for #${cleanId} from FastAPI (${endpoint}). Data source: SUPABASE POSTGRESQL (LIVE).`
        );
        
        // Fetch ML ETA prediction
        let etaData = null;
        try {
          const etaRes = await fetchFromApi(`/api/trains/${encodeURIComponent(cleanId)}/eta`);
          etaData = etaRes.data;
        } catch (etaErr) {
          console.warn(`[TrainETA API] Could not fetch ETA for #${cleanId}: ${etaErr.message}`);
        }
        
        if (etaData) {
          data.predicted_arrival = etaData.predicted_eta;
          data.confidence = etaData.confidence;
          data.prediction_type = etaData.prediction_type;
          data.baseline_eta = etaData.baseline_eta;
          data.baseline_delay = etaData.baseline_delay;
          data.scheduled_arrival = etaData.scheduled_eta;
        }

        // If track geometry or station list is missing, enrich from map telemetry
        if (!data.route_coordinates || data.route_coordinates.length === 0 || !data.stations || data.stations.length === 0) {
          try {
            const mapRes = await fetchFromApi(`/api/trains/${encodeURIComponent(cleanId)}/map`);
            if (mapRes?.data) {
              if (mapRes.data.route_coordinates?.length > 0 && (!data.route_coordinates || data.route_coordinates.length === 0)) {
                data.route_coordinates = mapRes.data.route_coordinates;
              }
              if (mapRes.data.stations?.length > 0 && (!data.stations || data.stations.length === 0)) {
                data.stations = mapRes.data.stations;
              }
              if (mapRes.data.current_position && !data.latitude && !data.longitude) {
                data.latitude = mapRes.data.current_position.latitude;
                data.longitude = mapRes.data.current_position.longitude;
              }
            }
          } catch {
            // Ignore map fetch failure
          }
        }

        const mapped = mapBackendTrainToFrontend(data, true);
        const idx = liveTrains.findIndex((t) => String(t.id) === cleanId || String(t.number) === cleanId);
        if (idx !== -1) liveTrains[idx] = mapped;
        else liveTrains.push(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn(`[TrainETA API] getTrainById for #${cleanId} failed (${err.message}). Attempting dynamic discovery.`);
      const discovered = await this.discoverTrain(cleanId);
      if (discovered) return discovered;
    }

    // For numeric train numbers: NEVER return fake/demo trains when RailRadar/backend has no data
    if (/^\d{3,7}$/.test(cleanId)) {
      return null;
    }

    // Match strictly by exact train number or ID in local store (non-numeric only):
    const exactLocalMatch =
      liveTrains.find((t) => String(t.id) === cleanId || String(t.number) === cleanId) ||
      DEMO_TRAINS.find((t) => String(t.id) === cleanId || String(t.number) === cleanId);

    if (exactLocalMatch) {
      return mapBackendTrainToFrontend(exactLocalMatch, false);
    }

    return null;
  },

  /**
   * Search trains by number, name, station, or status
   */
  async searchTrains(searchTerm = '', filters = {}) {
    const cleanTerm = (searchTerm || '').trim();
    const isNumericSearch = /^\d{3,7}$/.test(cleanTerm);

    const params = new URLSearchParams();
    if (cleanTerm) params.append('q', cleanTerm);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.source && filters.source !== 'all') params.append('source', filters.source);
    if (filters.destination && filters.destination !== 'all') params.append('destination', filters.destination);

    const queryStr = params.toString();
    const path = `/api/trains/search${queryStr ? `?${queryStr}` : ''}`;

    try {
      const { data, endpoint } = await fetchFromApi(path);
      if (Array.isArray(data)) {
        if (data.length > 0) {
          console.log(
            `[TrainETA API] SUCCESS: ${data.length} trains found from FastAPI search (${endpoint}). Data source: SUPABASE POSTGRESQL (LIVE).`
          );
          return data.map((t) => mapBackendTrainToFrontend(t, true));
        }
        // If backend explicitly returned 0 results:
        // For numeric search, do NOT fall back to local demo/database list!
        if (isNumericSearch) {
          return [];
        }
        return [];
      }
    } catch (err) {
      console.warn(`[TrainETA API] searchTrains failed (${err.message}).`);
      
      // If network/backend request failed and this is a numeric search, try dynamic discovery endpoint directly
      if (isNumericSearch) {
        try {
          const discovered = await this.discoverTrain(cleanTerm);
          if (discovered) {
            return [discovered];
          }
        } catch (discErr) {
          console.warn(`[TrainETA API] dynamic discovery failed for #${cleanTerm}:`, discErr);
        }
        return [];
      }
    }

    // Only for non-numeric searches when backend was offline/unreachable:
    if (!isNumericSearch) {
      const term = cleanTerm.toLowerCase();
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
    }

    return [];
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
   * Fetch the latest live GPS coordinate & telemetry for a train from FastAPI (/api/trains/:id/position)
   */
  async getTrainPosition(trainId) {
    try {
      const { data } = await fetchFromApi(`/api/trains/${encodeURIComponent(trainId)}/position`);
        return {
          latitude: data.latitude != null ? Number(data.latitude) : null,
          longitude: data.longitude != null ? Number(data.longitude) : null,
          station_latitude: data.station_latitude != null ? Number(data.station_latitude) : null,
          station_longitude: data.station_longitude != null ? Number(data.station_longitude) : null,
          speed: data.speed != null ? Number(data.speed) : null,
          delayMinutes: Number(data.delay_minutes ?? data.delay ?? 0),
          currentStation: data.current_station,
          nextStation: data.next_station,
          timestamp: data.timestamp,
          dataSource: data.data_source || 'SIMULATED',
          dataStatus: data.data_status || 'LIVE',
        };
    } catch (err) {
      console.warn(`[TrainETA API] getTrainPosition failed for #${trainId}: ${err.message}`);
    }
    return null;
  },

  /**
   * Simulate train movement step along the corridor waypoints
   * Advances position in database and returns updated telemetry and coordinates
   */
  async simulateStep(trainId) {
    try {
      const { data } = await fetchFromApi(`/api/trains/${encodeURIComponent(trainId)}/simulate_step`);
      if (data) {
        const mapped = mapBackendTrainToFrontend(data, true);
        const idx = liveTrains.findIndex((t) => String(t.id) === String(trainId) || String(t.number) === String(trainId));
        if (idx !== -1) {
          liveTrains[idx] = mapped;
        }
        return mapped;
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
