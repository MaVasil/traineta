// TrainETA Home / Dashboard Page — Premium with animated hero and mesh gradients
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Train,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Radio,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Database,
  Cpu,
  Zap,
} from 'lucide-react';
import { trainApi, getApiConnectionStatus } from '../services/api';
import { TrainCard } from '../components/TrainCard';
import { TrainSearch } from '../components/TrainSearch';
import { MetricCard } from '../components/MetricCard';
import { LoadingState, ErrorState } from '../components/LoadingState';

export function Dashboard() {
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [connStatus, setConnStatus] = useState(getApiConnectionStatus());
  const navigate = useNavigate();

  const fetchTrains = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await trainApi.getTrains();
      setTrains(data);
      setConnStatus(getApiConnectionStatus());
    } catch (err) {
      setError(err.message || 'Failed to load trains');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrains();
  }, []);

  const activeCount = trains.length;
  const delayedCount = trains.filter((t) => t.statusType !== 'ontime' && (t.currentDelayMin || 0) > 0).length;
  const onTimeCount = trains.filter((t) => t.statusType === 'ontime' || (t.currentDelayMin || 0) === 0).length;
  const avgDelay = trains.length > 0
    ? (trains.reduce((acc, t) => acc + (t.currentDelayMin || 0), 0) / trains.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-8 pb-12">
      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-[#111827] shadow-sm animate-fade-in-up">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 mesh-gradient pointer-events-none" />
        
        {/* Floating decorative elements */}
        <div className="absolute top-10 right-12 opacity-[0.04] dark:opacity-[0.06] pointer-events-none animate-float-slow">
          <Train className="w-64 h-64 text-blue-600" />
        </div>
        <div className="absolute bottom-4 right-40 opacity-[0.03] dark:opacity-[0.04] pointer-events-none animate-float-delay">
          <Cpu className="w-32 h-32 text-indigo-600" />
        </div>

        <div className="relative z-10 p-7 sm:p-10 lg:p-12">
          <div className="max-w-3xl">
            {/* System Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/50 text-xs font-bold text-blue-600 dark:text-blue-400 mb-5 animate-fade-in-up-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
              </span>
              <span>DYNAMIC RAILWAY INTELLIGENCE</span>
              <span className="text-blue-300 dark:text-blue-700">•</span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                ML Engine Active
              </span>
            </div>

            {/* Hero Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] animate-fade-in-up-2">
              Know when your train
              <br />
              <span className="gradient-text">will actually arrive.</span>
            </h1>

            {/* Hero Description */}
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl font-normal animate-fade-in-up-3">
              Track trains in real-time, understand delays with ML-powered analysis, and get dynamically predicted arrival times across the Southern Railway corridor.
            </p>

            {/* Feature Pills */}
            <div className="mt-5 flex flex-wrap gap-2 animate-fade-in-up-4">
              {[
                { icon: Zap, label: 'Real-Time Tracking', color: 'text-blue-600 dark:text-blue-400' },
                { icon: Sparkles, label: 'ML Predictions', color: 'text-violet-600 dark:text-violet-400' },
                { icon: Gauge, label: 'Speed Telemetry', color: 'text-cyan-600 dark:text-cyan-400' },
              ].map(({ icon: I, label, color }) => (
                <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/60 text-xs font-semibold ${color}`}>
                  <I className="w-3.5 h-3.5" />
                  {label}
                </span>
              ))}
            </div>

            {/* Primary Train Search */}
            <div className="mt-8 max-w-2xl animate-fade-in-up-5">
              <TrainSearch
                onSearch={(query) => {
                  if (query.trim()) {
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ NETWORK METRICS ═══════════════ */}
      <section className="animate-fade-in-up-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Corridor Operations Telemetry
          </h2>
          <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-0.5 rounded-full">
            South Central MAS-HYB
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Trains"
            value={activeCount}
            subtitle="Monitored on Southern Corridor"
            icon={Train}
            variant="blue"
            badge="Live"
          />
          <MetricCard
            title="Delayed Trains"
            value={delayedCount}
            subtitle="Active speed or signal holds"
            icon={AlertTriangle}
            variant="warning"
          />
          <MetricCard
            title="On-Time Trains"
            value={onTimeCount}
            subtitle="Adhering to punctuality index"
            icon={CheckCircle2}
            variant="success"
          />
          <MetricCard
            title="Average Delay"
            value={`+${avgDelay} min`}
            subtitle="Historical median +6.8 min"
            icon={Clock}
            variant="default"
          />
        </div>
      </section>

      {/* ═══════════════ ACTIVE TRAINS GRID ═══════════════ */}
      <section className="space-y-4 animate-fade-in-up-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Active Trains
              </h2>
              {connStatus.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/50">
                  <span>Demo</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trains running on the Hyderabad → Kazipet → Warangal → Vijayawada → Chennai corridor
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => fetchTrains(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 hover:border-blue-300 dark:hover:border-blue-700"
              title="Refresh trains from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 transition-all"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Fetching live telemetry from corridor block signals..." />
        ) : error ? (
          <ErrorState error={error} onRetry={fetchTrains} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {trains.map((train, index) => (
              <div key={train.id} className={`animate-fade-in-up-${Math.min(index + 1, 5)}`}>
                <TrainCard train={train} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
