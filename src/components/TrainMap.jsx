// TrainETA Interactive Railway Map Component
// Integrates Google Maps JavaScript API with dynamic route polyline, origin/destination markers, and live telemetry
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Train,
  MapPin,
  Compass,
  ZoomIn,
  ZoomOut,
  Navigation,
  Radio,
} from 'lucide-react';
import { mapService } from '../services/mapService';
import { isValidCoordinate, parseCoordinatePair } from '../services/api';

export function TrainMap({
  train,
  trains,
  isDark = false,
  height = '460px',
  onSelectStation,
}) {
  const activeTrain = train || (Array.isArray(trains) && trains.length > 0 ? trains[0] : null);

  const mapContainerRef = useRef(null);
  const googleMapInstanceRef = useRef(null);
  const trainMarkerRef = useRef(null);
  const otherTrainMarkersRef = useRef([]);
  const sourceMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const polylineRef = useRef(null);
  const lastFittedTrainIdRef = useRef(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 1. Dynamically derive stations from train telemetry (RailRadar halts or timeline)
  const stations = useMemo(() => {
    const raw = Array.isArray(activeTrain?.stations) && activeTrain.stations.length > 0
      ? activeTrain.stations
      : (Array.isArray(activeTrain?.timeline) && activeTrain.timeline.length > 0
          ? activeTrain.timeline
          : (Array.isArray(activeTrain?.halts) ? activeTrain.halts : []));

    return raw
      .map((st, idx) => {
        const lat = st.lat ?? st.latitude;
        const lng = st.lng ?? st.longitude;
        const validCoord = parseCoordinatePair(lat, lng);
        const code = String(st.code || st.station_code || st.stationCode || '').toUpperCase();
        const name = st.name || st.station_name || st.stationName || code;
        return {
          sequence: st.sequence != null ? Number(st.sequence) : idx + 1,
          name,
          code,
          lat: validCoord ? validCoord.lat : null,
          lng: validCoord ? validCoord.lng : null,
          distanceKm: st.distanceKm ?? st.distance ?? st.distance_from_source ?? 0,
          isCurrent: activeTrain?.currentStationCode && code === activeTrain.currentStationCode.toUpperCase(),
          isNext: activeTrain?.nextStationCode && code === activeTrain.nextStationCode.toUpperCase(),
          isPassed: st.state === 'completed' || st.status === 'COMPLETED' || st.status === 'DEPARTED',
        };
      })
      .filter((st) => st.lat != null && st.lng != null);
  }, [activeTrain?.id, activeTrain?.stations, activeTrain?.timeline, activeTrain?.halts, activeTrain?.currentStationCode, activeTrain?.nextStationCode]);

  // 2. Dynamically derive track polyline coordinates from train telemetry
  const routeCoordinates = useMemo(() => {
    const raw = Array.isArray(activeTrain?.routeCoordinates) && activeTrain.routeCoordinates.length > 0
      ? activeTrain.routeCoordinates
      : (Array.isArray(activeTrain?.route_coordinates) && activeTrain.route_coordinates.length > 0
          ? activeTrain.route_coordinates
          : []);

    if (raw.length > 0) {
      const parsed = raw
        .map((pt) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            return parseCoordinatePair(pt[0], pt[1]);
          }
          if (pt && typeof pt === 'object' && 'lat' in pt && 'lng' in pt) {
            return parseCoordinatePair(pt.lat, pt.lng);
          }
          return null;
        })
        .filter(Boolean);

      if (parsed.length > 0) return parsed;
    }

    // If track geometry LineString is unavailable, connect stations in sequence
    return stations.map((s) => ({ lat: s.lat, lng: s.lng }));
  }, [activeTrain?.id, activeTrain?.routeCoordinates, activeTrain?.route_coordinates, stations]);

  // 3. Dynamic Origin and Terminus endpoint objects
  const sourceObj = useMemo(() => {
    const obj = activeTrain?.sourceObj || activeTrain?.sourceDetails || activeTrain?.source_details;
    const code = String(obj?.code || activeTrain?.sourceCode || activeTrain?.source_code || stations[0]?.code || 'SRC').toUpperCase();
    const name = obj?.name || activeTrain?.sourceName || (typeof activeTrain?.source === 'string' && activeTrain.source !== 'Unknown' ? activeTrain.source : null) || stations[0]?.name || code;
    const sLat = obj?.latitude ?? obj?.lat ?? activeTrain?.source_latitude ?? stations[0]?.lat;
    const sLng = obj?.longitude ?? obj?.lng ?? activeTrain?.source_longitude ?? stations[0]?.lng;
    const coords = parseCoordinatePair(sLat, sLng);
    return { code, name, coords };
  }, [activeTrain, stations]);

  const destObj = useMemo(() => {
    const lastSt = stations.length > 0 ? stations[stations.length - 1] : null;
    const obj = activeTrain?.destObj || activeTrain?.destinationDetails || activeTrain?.destination_details;
    const code = String(obj?.code || activeTrain?.destCode || activeTrain?.destination_code || lastSt?.code || 'DST').toUpperCase();
    const name = obj?.name || activeTrain?.destinationName || (typeof activeTrain?.destination === 'string' && activeTrain.destination !== 'Unknown' ? activeTrain.destination : null) || lastSt?.name || destCode;
    const dLat = obj?.latitude ?? obj?.lat ?? activeTrain?.destination_latitude ?? lastSt?.lat;
    const dLng = obj?.longitude ?? obj?.lng ?? activeTrain?.destination_longitude ?? lastSt?.lng;
    const coords = parseCoordinatePair(dLat, dLng);
    return { code, name, coords };
  }, [activeTrain, stations]);

  // 4. Authentic train live coordinates
  const liveCoords = useMemo(() => {
    const rawLat = activeTrain?.latitude ?? activeTrain?.currentCoords?.lat ?? activeTrain?.current_position?.latitude;
    const rawLng = activeTrain?.longitude ?? activeTrain?.currentCoords?.lng ?? activeTrain?.current_position?.longitude;
    const normTrain = parseCoordinatePair(rawLat, rawLng);
    if (normTrain) return normTrain;

    const stLat = activeTrain?.station_latitude ?? activeTrain?.stationCoords?.lat ?? activeTrain?.station_position?.latitude;
    const stLng = activeTrain?.station_longitude ?? activeTrain?.stationCoords?.lng ?? activeTrain?.station_position?.longitude;
    return parseCoordinatePair(stLat, stLng);
  }, [activeTrain?.latitude, activeTrain?.longitude, activeTrain?.currentCoords, activeTrain?.stationCoords, activeTrain?.station_latitude, activeTrain?.station_longitude]);

  // 5. Multi-train dynamic markers support from trains array
  const otherTrains = useMemo(() => {
    if (!Array.isArray(trains) || trains.length <= 1) return [];
    return trains
      .filter((t) => t && String(t.id || t.number) !== String(activeTrain?.id || activeTrain?.number))
      .map((t) => {
        const lat = t.latitude ?? t.currentCoords?.lat ?? t.current_position?.latitude;
        const lng = t.longitude ?? t.currentCoords?.lng ?? t.current_position?.longitude;
        const coords = parseCoordinatePair(lat, lng);
        if (!coords) return null;
        return {
          id: t.id || t.number,
          number: t.number || t.trainNumber || t.id,
          name: t.name || t.trainName || '',
          lat: coords.lat,
          lng: coords.lng,
          speed: t.speed ?? t.currentSpeed,
        };
      })
      .filter(Boolean);
  }, [trains, activeTrain?.id, activeTrain?.number]);

  const hasCoords = Boolean(liveCoords);

  // Initialize Google Maps instance
  useEffect(() => {
    let isCancelled = false;

    async function initGoogleMaps() {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey || apiKey === 'your_google_maps_api_key' || apiKey.trim() === '') {
        setUseFallback(true);
        return;
      }

      try {
        const maps = await mapService.loadGoogleMaps();
        if (isCancelled) return;

        if (maps && mapContainerRef.current) {
          const initialCenter = liveCoords || sourceObj.coords || (stations[0] ? { lat: stations[0].lat, lng: stations[0].lng } : { lat: 17.385, lng: 78.4867 });
          const map = new maps.Map(mapContainerRef.current, {
            center: initialCenter,
            zoom: 8,
            styles: isDark ? mapService.getDarkStyles() : mapService.getLightStyles(),
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          googleMapInstanceRef.current = map;
          setMapsLoaded(true);
          setUseFallback(false);
        } else {
          setUseFallback(true);
        }
      } catch (err) {
        console.warn('Google Maps initialization failed, switching to fallback visualizer:', err);
        setUseFallback(true);
      }
    }

    initGoogleMaps();

    return () => {
      isCancelled = true;
      if (polylineRef.current) polylineRef.current.setMap(null);
      stationMarkersRef.current.forEach((m) => m.setMap(null));
      if (trainMarkerRef.current) trainMarkerRef.current.setMap(null);
      if (sourceMarkerRef.current) sourceMarkerRef.current.setMap(null);
      if (destMarkerRef.current) destMarkerRef.current.setMap(null);
      googleMapInstanceRef.current = null;
    };
  }, []);

  // Update styles if dark mode changes
  useEffect(() => {
    if (googleMapInstanceRef.current && window.google?.maps) {
      googleMapInstanceRef.current.setOptions({
        styles: isDark ? mapService.getDarkStyles() : mapService.getLightStyles(),
      });
    }
  }, [isDark]);

  // Update Polyline, Endpoints & Station Markers dynamically
  useEffect(() => {
    const map = googleMapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    // 1. Clear previous polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // 2. Clear previous station markers
    stationMarkersRef.current.forEach((m) => m.setMap(null));
    stationMarkersRef.current = [];

    // 3. Render Route Polyline
    if (routeCoordinates.length > 0) {
      polylineRef.current = new window.google.maps.Polyline({
        path: routeCoordinates,
        geodesic: true,
        strokeColor: '#2563EB',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });
    }

    // 4. Render Origin (Source) Marker
    if (sourceObj.coords) {
      if (sourceMarkerRef.current) {
        sourceMarkerRef.current.setPosition(sourceObj.coords);
        sourceMarkerRef.current.setTitle(`Origin: ${sourceObj.name} (${sourceObj.code})`);
      } else {
        sourceMarkerRef.current = new window.google.maps.Marker({
          position: sourceObj.coords,
          map,
          title: `Origin: ${sourceObj.name} (${sourceObj.code})`,
          icon: mapService.createEndpointMarkerIcon('source'),
          zIndex: 60,
        });
      }
    } else if (sourceMarkerRef.current) {
      sourceMarkerRef.current.setMap(null);
      sourceMarkerRef.current = null;
    }

    // 5. Render Terminus (Destination) Marker
    if (destObj.coords) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setPosition(destObj.coords);
        destMarkerRef.current.setTitle(`Terminus: ${destObj.name} (${destObj.code})`);
      } else {
        destMarkerRef.current = new window.google.maps.Marker({
          position: destObj.coords,
          map,
          title: `Terminus: ${destObj.name} (${destObj.code})`,
          icon: mapService.createEndpointMarkerIcon('destination'),
          zIndex: 60,
        });
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null);
      destMarkerRef.current = null;
    }

    // 6. Render Intermediate Station Markers (excluding endpoints)
    stationMarkersRef.current = stations
      .filter((st) => {
        if (sourceObj.coords && Math.abs(st.lat - sourceObj.coords.lat) < 0.001 && Math.abs(st.lng - sourceObj.coords.lng) < 0.001) return false;
        if (destObj.coords && Math.abs(st.lat - destObj.coords.lat) < 0.001 && Math.abs(st.lng - destObj.coords.lng) < 0.001) return false;
        return true;
      })
      .map((station) => {
        const isCurrent = station.isCurrent || (activeTrain?.currentStationCode && station.code === activeTrain.currentStationCode.toUpperCase());
        const marker = new window.google.maps.Marker({
          position: { lat: station.lat, lng: station.lng },
          map,
          title: `${station.name} (${station.code})`,
          icon: mapService.createStationMarkerIcon(station.isPassed, isCurrent),
        });

        marker.addListener('click', () => {
          setSelectedStation(station);
          if (onSelectStation) onSelectStation(station);
        });

        return marker;
      });

    // 7. Adjust Map Bounds on Train Switch
    if (activeTrain?.id && lastFittedTrainIdRef.current !== activeTrain.id) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      if (liveCoords) {
        bounds.extend(liveCoords);
        hasPoints = true;
      }
      if (sourceObj.coords) {
        bounds.extend(sourceObj.coords);
        hasPoints = true;
      }
      if (destObj.coords) {
        bounds.extend(destObj.coords);
        hasPoints = true;
      }
      routeCoordinates.forEach((pt) => {
        bounds.extend(pt);
        hasPoints = true;
      });
      stations.forEach((st) => {
        bounds.extend({ lat: st.lat, lng: st.lng });
        hasPoints = true;
      });

      if (hasPoints) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        lastFittedTrainIdRef.current = activeTrain.id;
      }
    }
  }, [routeCoordinates, stations, sourceObj, destObj, activeTrain?.id]);

  // Update Train Marker dynamically when live coordinates update
  useEffect(() => {
    const map = googleMapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (liveCoords) {
      const newPos = new window.google.maps.LatLng(liveCoords.lat, liveCoords.lng);
      const speedVal = activeTrain?.speed ?? activeTrain?.currentSpeed;
      const speedText = speedVal != null ? `${speedVal} km/h` : 'Speed N/A';
      const titleText = `Train ${activeTrain?.number || ''} (${speedText})`;

      if (trainMarkerRef.current) {
        trainMarkerRef.current.setPosition(newPos);
        trainMarkerRef.current.setTitle(titleText);
      } else {
        trainMarkerRef.current = new window.google.maps.Marker({
          position: newPos,
          map,
          title: titleText,
          icon: mapService.createTrainMarkerIcon(isDark),
          zIndex: 100,
        });
      }
    } else if (trainMarkerRef.current) {
      trainMarkerRef.current.setMap(null);
      trainMarkerRef.current = null;
    }
  }, [liveCoords?.lat, liveCoords?.lng, activeTrain?.number, activeTrain?.speed, activeTrain?.currentSpeed, isDark]);

  // Multi-train dynamic markers: Render any other trains passed in the trains array
  useEffect(() => {
    const map = googleMapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    otherTrainMarkersRef.current.forEach((m) => m.setMap(null));
    otherTrainMarkersRef.current = [];

    otherTrains.forEach((ot) => {
      const pos = new window.google.maps.LatLng(ot.lat, ot.lng);
      const speedText = ot.speed != null ? `${ot.speed} km/h` : 'Speed N/A';
      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: `Train ${ot.number} - ${ot.name} (${speedText})`,
        icon: mapService.createTrainMarkerIcon(isDark),
        zIndex: 90,
      });
      otherTrainMarkersRef.current.push(marker);
    });
  }, [otherTrains, isDark]);

  // ── Dynamic SVG Fallback Calculations ──
  const bounds = useMemo(() => {
    const allLats = [];
    const allLngs = [];

    if (liveCoords) {
      allLats.push(liveCoords.lat);
      allLngs.push(liveCoords.lng);
    }
    otherTrains.forEach((ot) => {
      allLats.push(ot.lat);
      allLngs.push(ot.lng);
    });
    if (sourceObj.coords) {
      allLats.push(sourceObj.coords.lat);
      allLngs.push(sourceObj.coords.lng);
    }
    if (destObj.coords) {
      allLats.push(destObj.coords.lat);
      allLngs.push(destObj.coords.lng);
    }
    routeCoordinates.forEach((pt) => {
      allLats.push(pt.lat);
      allLngs.push(pt.lng);
    });
    stations.forEach((st) => {
      allLats.push(st.lat);
      allLngs.push(st.lng);
    });

    if (allLats.length === 0 || allLngs.length === 0) {
      return { minLat: 16.0, maxLat: 19.0, minLng: 77.0, maxLng: 80.0 };
    }

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const padLat = Math.max(0.08, (maxLat - minLat) * 0.1);
    const padLng = Math.max(0.08, (maxLng - minLng) * 0.1);

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    };
  }, [liveCoords, sourceObj, destObj, routeCoordinates, stations]);

  const projectCoord = (lat, lng) => {
    const latSpan = Math.max(0.001, bounds.maxLat - bounds.minLat);
    const lngSpan = Math.max(0.001, bounds.maxLng - bounds.minLng);
    const x = ((lng - bounds.minLng) / lngSpan) * 680 + 60;
    const y = ((bounds.maxLat - lat) / latSpan) * 380 + 60;
    return { x, y };
  };

  const trainPos = liveCoords ? projectCoord(liveCoords.lat, liveCoords.lng) : null;

  // Sample routeCoordinates for SVG polyline (max 300 points for smooth SVG performance)
  const sampledRoute = useMemo(() => {
    if (routeCoordinates.length <= 300) return routeCoordinates;
    const step = Math.ceil(routeCoordinates.length / 300);
    return routeCoordinates.filter((_, idx) => idx % step === 0 || idx === routeCoordinates.length - 1);
  }, [routeCoordinates]);

  const polylinePoints = useMemo(() => {
    return sampledRoute
      .map((w) => {
        const p = projectCoord(w.lat, w.lng);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
  }, [sampledRoute, bounds]);

  // Fallback map pan & zoom handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const displaySpeed = activeTrain?.speed ?? activeTrain?.currentSpeed;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-white shadow-md">
      {/* Top Banner indicating Google Map vs Fallback mode & GPS status */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100%-80px)]">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-200 shadow-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>
            {useFallback
              ? 'Route Visualizer Active'
              : 'Google Maps Telemetry Active'}
          </span>
        </div>

        {!hasCoords && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-950/90 backdrop-blur-md border border-amber-500/50 text-xs font-semibold text-amber-300 shadow-md flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Live GPS location unavailable — tracked via railway station halts</span>
          </div>
        )}

        {activeTrain && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/90 backdrop-blur-md text-xs font-bold text-white shadow-md font-mono">
            <Train className="w-3.5 h-3.5" />
            <span>{activeTrain.number} • {displaySpeed != null ? `${displaySpeed} km/h` : 'Speed N/A'}</span>
          </div>
        )}
      </div>

      {/* Map Action Controls (Zoom, Recenter) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (googleMapInstanceRef.current) {
              googleMapInstanceRef.current.setZoom(googleMapInstanceRef.current.getZoom() + 1);
            } else {
              setZoomLevel((z) => Math.min(2.5, z + 0.25));
            }
          }}
          className="p-2 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-md transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (googleMapInstanceRef.current) {
              googleMapInstanceRef.current.setZoom(googleMapInstanceRef.current.getZoom() - 1);
            } else {
              setZoomLevel((z) => Math.max(0.75, z - 0.25));
            }
          }}
          className="p-2 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-md transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (googleMapInstanceRef.current && liveCoords) {
              googleMapInstanceRef.current.panTo(liveCoords);
              googleMapInstanceRef.current.setZoom(10);
            } else if (googleMapInstanceRef.current && stations.length > 0) {
              const bounds = new window.google.maps.LatLngBounds();
              stations.forEach((st) => bounds.extend({ lat: st.lat, lng: st.lng }));
              googleMapInstanceRef.current.fitBounds(bounds);
            } else {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }
          }}
          className="p-2 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-md transition-colors"
          title="Recenter to train"
          aria-label="Recenter to train"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Main Map Rendering Area */}
      {!useFallback ? (
        <div
          ref={mapContainerRef}
          style={{ height }}
          className="w-full bg-[#0B1220]"
        />
      ) : (
        /* Professional Fallback Route Canvas / SVG Visualizer */
        <div
          style={{ height }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full bg-[#0B1220] relative cursor-grab active:cursor-grabbing overflow-hidden select-none"
        >
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          <svg
            viewBox="0 0 800 500"
            className="w-full h-full"
            style={{
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <defs>
              <linearGradient id="routeTrackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#F43F5E" />
              </linearGradient>
              <filter id="trainGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3B82F6" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Route Railway Track */}
            {polylinePoints && (
              <>
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="url(#routeTrackGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Station Halts */}
            {stations.map((st, idx) => {
              const p = projectCoord(st.lat, st.lng);
              const isCurrent = st.isCurrent || (activeTrain?.currentStationCode && st.code === activeTrain.currentStationCode.toUpperCase());
              const isNext = st.isNext || (activeTrain?.nextStationCode && st.code === activeTrain.nextStationCode.toUpperCase());
              const isOrigin = idx === 0;
              const isTerminus = idx === stations.length - 1;
              const shouldShowLabel = isCurrent || isNext || isOrigin || isTerminus || stations.length <= 15;

              return (
                <g
                  key={`${st.code}-${idx}`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStation(st);
                    if (onSelectStation) onSelectStation(st);
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isCurrent ? '9' : isOrigin || isTerminus ? '8' : '5'}
                    fill={isOrigin ? '#10B981' : isTerminus ? '#F43F5E' : isCurrent ? '#2563EB' : st.isPassed ? '#16A34A' : '#1F2937'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />

                  {shouldShowLabel && (
                    <>
                      <text
                        x={p.x + 12}
                        y={p.y + 4}
                        fill="#F9FAFB"
                        fontSize={isCurrent ? '11' : '10'}
                        fontWeight={isCurrent || isOrigin || isTerminus ? '800' : '600'}
                        fontFamily="Inter, sans-serif"
                      >
                        {st.name} ({st.code})
                      </text>
                      {st.distanceKm > 0 && (
                        <text
                          x={p.x + 12}
                          y={p.y + 15}
                          fill="#9CA3AF"
                          fontSize="8.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {st.distanceKm} km
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}

            {/* Live Moving Train Marker */}
            {trainPos && (
              <g
                transform={`translate(${trainPos.x}, ${trainPos.y})`}
                filter="url(#trainGlow)"
                className="cursor-pointer"
                style={{ transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                <circle r="18" fill="#2563EB" opacity="0.3" className="animate-ping" />
                <circle r="14" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />
                <path
                  d="M-5 -6 C-5 -7.5 -4 -8 -2 -8 L2 -8 C4 -8 5 -7.5 5 -6 L5 4 C5 5.5 4 6 2 6 L-2 6 C-4 6 -5 5.5 -5 4 Z M-3.5 -4 L3.5 -4 M-3.5 -1 L3.5 -1 M-2.5 3.5 A1 1 0 1 0 -2.5 4 M2.5 3.5 A1 1 0 1 0 2.5 4"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <rect
                  x="-48"
                  y="-32"
                  width="96"
                  height="18"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.95)"
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-20"
                  textAnchor="middle"
                  fill="#F9FAFB"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {activeTrain?.number || 'TRAIN'} • {displaySpeed != null ? `${displaySpeed} km/h` : 'Speed N/A'}
                </text>
              </g>
            )}

            {/* Other trains in multi-train map */}
            {otherTrains.map((ot) => {
              const otPt = project(ot.lat, ot.lng);
              const otSpeedText = ot.speed != null ? `${ot.speed} km/h` : 'Speed N/A';
              return (
                <g key={`other-train-${ot.id}`} transform={`translate(${otPt.x}, ${otPt.y})`}>
                  <circle r={8} fill="#3b82f6" stroke="#ffffff" strokeWidth={2} />
                  <text
                    y={-12}
                    textAnchor="middle"
                    fill={isDark ? '#93c5fd' : '#1d4ed8'}
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ot.number}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Station halt fallback overlay when GPS coordinates are unavailable */}
          {!hasCoords && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
              <div className="pointer-events-auto max-w-sm w-full p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                    <Train className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {activeTrain?.name || 'Express Train'} (#{activeTrain?.number})
                    </h4>
                    <p className="text-[11px] text-amber-300 font-medium">
                      GPS signal unavailable — tracked via railway station halts
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Halt</span>
                    <p className="font-bold text-white truncate">{activeTrain?.currentStation || 'In Transit'}</p>
                    <span className="text-[10px] font-mono text-slate-400">{activeTrain?.currentStationCode || 'TRN'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Next Station</span>
                    <p className="font-bold text-white truncate">{activeTrain?.nextStation || 'Approaching'}</p>
                    <span className="text-[10px] font-mono text-slate-400">{activeTrain?.nextStationCode || 'APR'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Delay:</span>
                  <span className={`font-mono font-bold ${activeTrain?.currentDelayMin > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeTrain?.currentDelayMin > 0 ? `+${activeTrain.currentDelayMin} min delay` : 'On Time'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Station Popover Overlay */}
      {selectedStation && (
        <div className="absolute bottom-4 left-4 z-20 max-w-xs p-3.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/90 text-xs shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-bold text-white text-sm">
              {selectedStation.name} ({selectedStation.code})
            </span>
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-slate-300">
            {selectedStation.distanceKm > 0 && (
              <p>Route Distance: <span className="font-mono text-white font-bold">{selectedStation.distanceKm} km</span></p>
            )}
            <p>Coordinates: <span className="font-mono text-slate-400">{selectedStation.lat.toFixed(4)}, {selectedStation.lng.toFixed(4)}</span></p>
          </div>
        </div>
      )}

      {/* Legend Footer */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-medium text-slate-300">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Origin
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Terminus
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Live Train
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Halt
        </span>
      </div>
    </div>
  );
}
