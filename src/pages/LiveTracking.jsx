// TrainETA Live Tracking Page — Premium with enhanced telemetry cards
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Train,
  MapPin,
  Gauge,
  Clock,
  Radio,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Navigation,
} from 'lucide-react';
import { trainApi, mapBackendTrainToFrontend } from '../services/api';
import { TrainMap } from '../components/TrainMap';
import { ETACard } from '../components/ETACard';
import { StationTimeline } from '../components/StationTimeline';
import { LoadingState, ErrorState } from '../components/LoadingState';

export function LiveTracking({ isDark = false }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trains, setTrains] = useState([]);
  const [activeTrain, setActiveTrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isSimulating, setIsSimulating] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const simulationIntervalRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const allTrains = await trainApi.getTrains();
        setTrains(allTrains);
        const targetId = id || '12401';
        const current = allTrains.find((t) => t.id === targetId) || allTrains[0];
        setActiveTrain(current);
      } catch (err) {
        setError(err.message || 'Error loading live tracking');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // ── WebSocket: receive server-pushed position updates from simulation_ticker ──
  useEffect(() => {
    // Build WS URL relative to current location (works for both dev proxy and production)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsBase = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/^https?:/, wsProtocol)
      : `${wsProtocol}//${window.location.host}`;
    const wsUrl = `${wsBase}/ws/tracking`;

    let ws = null;
    let reconnectTimer = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[TrainETA WS] Connected to', wsUrl);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if ((msg.type === 'position_update' || msg.type === 'initial_data') && Array.isArray(msg.trains)) {
              const mapped = msg.trains.map((t) => mapBackendTrainToFrontend(t, true));
              setTrains(mapped);
              setActiveTrain((prev) => {
                if (!prev) return mapped[0] || null;
                const freshTrain = mapped.find(
                  (t) => String(t.id) === String(prev.id) || String(t.number) === String(prev.id)
                );
                return freshTrain || prev;
              });
            }
          } catch (e) {
            // ignore malformed WS messages
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            console.warn('[TrainETA WS] Disconnected — reconnecting in 5s');
            reconnectTimer = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          console.warn('[TrainETA WS] Connection error — will fall back to HTTP polling');
          ws?.close();
        };
      } catch (e) {
        console.warn('[TrainETA WS] Could not open WebSocket:', e.message);
      }
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // ── HTTP Polling: simulate_step (runs even when WS is active for extra reliability) ──
  useEffect(() => {
    if (!activeTrain?.id) {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      return;
    }

    if (isSimulating) {
      const intervalMs = Math.max(800, Math.round(3000 / simSpeed));
      simulationIntervalRef.current = setInterval(async () => {
        const idToUpdate = activeTrain?.id;
        if (!idToUpdate) return;
        try {
          const updated = await trainApi.simulateStep(idToUpdate);
          if (updated) {
            setActiveTrain(updated);
          }
        } catch (err) {
          console.error("Simulation polling failed:", err);
        }
      }, intervalMs);
    } else {
      // Live polling (every 4 seconds) to keep train position synchronized with database when simulation is paused
      simulationIntervalRef.current = setInterval(async () => {
        const idToUpdate = activeTrain?.id;
        if (!idToUpdate) return;
        try {
          const pos = await trainApi.getTrainPosition(idToUpdate);
          if (pos && !isNaN(pos.latitude) && !isNaN(pos.longitude)) {
            setActiveTrain((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                currentCoords: { lat: pos.latitude, lng: pos.longitude },
                currentSpeed: pos.speed ?? prev.currentSpeed,
                currentDelayMin: pos.delayMinutes ?? prev.currentDelayMin,
                currentStation: pos.currentStation || prev.currentStation,
                nextStation: pos.nextStation || prev.nextStation,
              };
            });
          }
        } catch (err) {
          console.error("Live telemetry polling failed:", err);
        }
      }, 4000);
    }

    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, [isSimulating, simSpeed, activeTrain?.id]);

  const handleSelectTrain = (newTrainId) => navigate(`/tracking/${newTrainId}`);
  const handleStepOnce = async () => {
    if (activeTrain) {
      try {
        const updated = await trainApi.simulateStep(activeTrain.id);
        if (updated) setActiveTrain(updated);
      } catch (err) {
        console.error("Step once failed:", err);
      }
    }
  };
  const handleResetSimulation = () => {
    trainApi.resetSimulation();
    if (activeTrain) trainApi.getTrainById(activeTrain.id).then((t) => setActiveTrain(t));
  };

  if (loading) return <LoadingState message="Initializing real-time corridor map and satellite feeds..." />;
  if (error || !activeTrain) return <ErrorState error={error || 'Train not found'} onRetry={() => navigate('/tracking/12401')} />;

  const isDelayed = activeTrain.currentDelayMin > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* ═══════════════ SIMULATION BANNER ═══════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-800/40 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              LIVE SIMULATION MODE
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Real-time position updates along corridor track waypoints
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden md:inline">Train:</span>
          <select
            value={activeTrain.id}
            onChange={(e) => handleSelectTrain(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {trains.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.number} — {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══════════════ SPLIT SCREEN ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Train Telemetry */}
        <div className="lg:col-span-5 space-y-4 animate-fade-in-up-1">
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] space-y-4">
            {/* Train Identity */}
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                  {activeTrain.number}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {activeTrain.name}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeTrain.source} → {activeTrain.destination}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                !isDelayed
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                  : activeTrain.currentDelayMin <= 10
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40'
              }`}>
                {activeTrain.status}
              </span>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
              {[
                { icon: MapPin, label: 'CURRENT', value: activeTrain.currentStation, sub: activeTrain.currentStationCode, color: 'text-blue-500' },
                { icon: Navigation, label: 'NEXT STOP', value: activeTrain.nextStation, sub: activeTrain.nextStationCode, color: 'text-indigo-500' },
                { icon: Gauge, label: 'SPEED', value: `${activeTrain.currentSpeed} km/h`, sub: 'Traction Nominal', color: 'text-cyan-500' },
                { icon: Clock, label: 'DELAY', value: isDelayed ? `+${activeTrain.currentDelayMin} min` : 'On Schedule', sub: isDelayed ? 'Variance Hold' : 'Zero Delay', color: isDelayed ? 'text-amber-500' : 'text-emerald-500' },
              ].map(({ icon: I, label, value, sub, color }) => (
                <div key={label} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-700/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <I className={`w-3 h-3 ${color}`} />
                    {label}
                  </span>
                  <p className={`text-sm font-bold mt-0.5 truncate ${
                    label === 'DELAY' && isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {value}
                  </p>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Simulation Controller */}
            <div className="pt-3 border-t border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    isSimulating
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  }`}
                >
                  {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSimulating ? 'Pause' : 'Resume'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStepOnce}
                  title="Step 1 waypoint ahead"
                  className="px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Step
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Speed:</span>
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setSimSpeed(speed)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      simSpeed === speed
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleResetSimulation}
                  title="Reset positions"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Map */}
        <div className="lg:col-span-7 animate-fade-in-up-2">
          <TrainMap train={activeTrain} isDark={isDark} height="440px" />
        </div>
      </div>

      {/* ═══════════════ ETA CARD ═══════════════ */}
      <section className="animate-fade-in-up-3">
        <ETACard
          nextStation={activeTrain.nextStation}
          scheduledTime={activeTrain.scheduledArrivalAtNext}
          predictedTime={activeTrain.predictedArrivalAtNext}
          delayMin={activeTrain.currentDelayMin}
          confidence={activeTrain.predictionConfidence}
          predictionType={activeTrain.predictionType}
          baselineTime={activeTrain.baselineEta}
          baselineDelay={activeTrain.baselineDelay}
        />
      </section>

      {/* ═══════════════ TIMELINE ═══════════════ */}
      <section className="animate-fade-in-up-4">
        <StationTimeline
          timeline={activeTrain.timeline}
          currentStationCode={activeTrain.currentStationCode}
        />
      </section>
    </div>
  );
}
