// TrainETA Interactive Railway Map Component
// Integrates Google Maps JavaScript API with graceful fallback to interactive route visualizer
import React, { useEffect, useRef, useState } from 'react';
import {
  Train,
  MapPin,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Navigation,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { mapService } from '../services/mapService';
import { CORRIDOR_STATIONS, CORRIDOR_WAYPOINTS } from '../data/demoTrains';

export function TrainMap({
  train,
  isDark = false,
  height = '460px',
  onSelectStation,
}) {
  const mapContainerRef = useRef(null);
  const googleMapInstanceRef = useRef(null);
  const trainMarkerRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const polylineRef = useRef(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize Google Maps or trigger fallback
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
          const center = train?.currentCoords || { lat: 16.5186, lng: 80.6195 };
          const map = new maps.Map(mapContainerRef.current, {
            center,
            zoom: 8,
            styles: isDark ? mapService.getDarkStyles() : mapService.getLightStyles(),
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          googleMapInstanceRef.current = map;

          // Add Route Polyline
          const path = CORRIDOR_WAYPOINTS.map((w) => ({ lat: w.lat, lng: w.lng }));
          polylineRef.current = new maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#2563EB',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map,
          });

          // Add Stations
          stationMarkersRef.current = CORRIDOR_STATIONS.map((station) => {
            const marker = new maps.Marker({
              position: { lat: station.lat, lng: station.lng },
              map,
              title: `${station.name} (${station.code})`,
              icon: mapService.createStationMarkerIcon(false, station.code === train?.currentStationCode),
            });

            marker.addListener('click', () => {
              setSelectedStation(station);
              if (onSelectStation) onSelectStation(station);
            });

            return marker;
          });

          // Add Train Marker
          if (train?.currentCoords) {
            trainMarkerRef.current = new maps.Marker({
              position: train.currentCoords,
              map,
              title: `${train.number} ${train.name}`,
              icon: mapService.createTrainMarkerIcon(isDark),
              zIndex: 999,
            });
          }

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
      googleMapInstanceRef.current = null;
    };
  }, []);

  // Update styles if dark mode changes on active Google Map
  useEffect(() => {
    if (googleMapInstanceRef.current && window.google?.maps) {
      googleMapInstanceRef.current.setOptions({
        styles: isDark ? mapService.getDarkStyles() : mapService.getLightStyles(),
      });
    }
  }, [isDark]);

  // Update train marker position when train coordinates change
  useEffect(() => {
    if (trainMarkerRef.current && train?.currentCoords && window.google?.maps) {
      const lat = Number(train.currentCoords.lat);
      const lng = Number(train.currentCoords.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const newPos = new window.google.maps.LatLng(lat, lng);
        trainMarkerRef.current.setPosition(newPos);
      }
    }
  }, [train?.currentCoords?.lat, train?.currentCoords?.lng]);

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

  // Fallback coordinate conversion into SVG viewBox (800 x 500)
  // Latitude spans: 13.08 (MAS) to 18.0 (KZJ/WL)
  // Longitude spans: 78.4 (HYB) to 80.65 (BZA/MAS)
  const minLat = 12.8;
  const maxLat = 18.2;
  const minLng = 78.2;
  const maxLng = 81.0;

  const projectCoord = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 680 + 60;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 380 + 60;
    return { x, y };
  };

  const isValidCoord = (c) =>
    c &&
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    !isNaN(c.lat) &&
    !isNaN(c.lng);

  const trainPos = isValidCoord(train?.currentCoords)
    ? projectCoord(train.currentCoords.lat, train.currentCoords.lng)
    : projectCoord(17.9689, 79.5941);

  const polylinePoints = CORRIDOR_WAYPOINTS.map((w) => {
    const p = projectCoord(w.lat, w.lng);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-white shadow-md">
      {/* Top Banner indicating Google Map vs Fallback mode */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-200 shadow-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>
            {useFallback
              ? 'Google Maps unavailable • Demo route visualization active'
              : 'Google Maps Telemetry Active'}
          </span>
        </div>

        {train && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/90 backdrop-blur-md text-xs font-bold text-white shadow-md font-mono">
            <Train className="w-3.5 h-3.5" />
            <span>{train.number} • {train.currentSpeed} km/h</span>
          </div>
        )}
      </div>

      {/* Map Action Controls (Zoom, Reset) */}
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
            if (googleMapInstanceRef.current && train?.currentCoords) {
              googleMapInstanceRef.current.panTo(train.currentCoords);
              googleMapInstanceRef.current.setZoom(8);
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
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#2563EB 1px, transparent 1px)',
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
              {/* Polyline gradient */}
              <linearGradient id="corridorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <filter id="trainGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#2563EB" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Railway Polyline Track */}
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
              stroke="url(#corridorGradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Intermediate waypoints dots */}
            {CORRIDOR_WAYPOINTS.map((wp, idx) => {
              const p = projectCoord(wp.lat, wp.lng);
              return (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="2"
                  fill="#64748B"
                  opacity="0.6"
                />
              );
            })}

            {/* Major Corridor Stations */}
            {CORRIDOR_STATIONS.map((st) => {
              const p = projectCoord(st.lat, st.lng);
              const isCurrent = train && train.currentStationCode === st.code;
              const isPassed = train && train.timeline?.find((t) => t.code === st.code)?.state === 'completed';

              return (
                <g
                  key={st.code}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStation(st);
                    if (onSelectStation) onSelectStation(st);
                  }}
                >
                  {/* Station node circle */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isCurrent ? '10' : '7'}
                    fill={isCurrent ? '#2563EB' : isPassed ? '#16A34A' : '#1F2937'}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />

                  {/* Label Text */}
                  <text
                    x={p.x + 14}
                    y={p.y + 4}
                    fill="#F9FAFB"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                  >
                    {st.name} ({st.code})
                  </text>
                  <text
                    x={p.x + 14}
                    y={p.y + 16}
                    fill="#9CA3AF"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {st.distanceKm} km
                  </text>
                </g>
              );
            })}

            {/* Live Moving Train Marker */}
            <g
              transform={`translate(${trainPos.x}, ${trainPos.y})`}
              filter="url(#trainGlow)"
              className="cursor-pointer"
              style={{ transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              {/* Pulse rings */}
              <circle r="18" fill="#2563EB" opacity="0.3" className="animate-ping" />
              <circle r="14" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />
              {/* Train icon in SVG */}
              <path
                d="M-5 -6 C-5 -7.5 -4 -8 -2 -8 L2 -8 C4 -8 5 -7.5 5 -6 L5 4 C5 5.5 4 6 2 6 L-2 6 C-4 6 -5 5.5 -5 4 Z M-3.5 -4 L3.5 -4 M-3.5 -1 L3.5 -1 M-2.5 3.5 A1 1 0 1 0 -2.5 4 M2.5 3.5 A1 1 0 1 0 2.5 4"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinecap="round"
              />

              {/* Train Tag Label */}
              <rect
                x="-40"
                y="-32"
                width="80"
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
                {train?.number || '12401'} • {train?.currentSpeed || 78}km/h
              </text>
            </g>
          </svg>
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
            <p>Corridor Distance: <span className="font-mono text-white font-bold">{selectedStation.distanceKm} km</span></p>
            <p>GPS Coordinates: <span className="font-mono text-slate-400">{selectedStation.lat.toFixed(4)}, {selectedStation.lng.toFixed(4)}</span></p>
          </div>
        </div>
      )}

      {/* Legend Footer */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-medium text-slate-300">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Passed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Current
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Upcoming
        </span>
      </div>
    </div>
  );
}
