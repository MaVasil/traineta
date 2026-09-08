// TrainETA Train Details Page — Premium with hero layout
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Train,
  MapPin,
  Gauge,
  Clock,
  ArrowLeft,
  Radio,
  Sparkles,
  Navigation,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { trainApi } from '../services/api';
import { ETACard } from '../components/ETACard';
import { StationTimeline } from '../components/StationTimeline';
import { LoadingState, ErrorState } from '../components/LoadingState';

export function TrainDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [train, setTrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setTrain(null);
        const data = await trainApi.getTrainById(id);
        if (!data) {
          setError(`Train #${id} could not be found or live telemetry is unavailable.`);
        } else {
          setTrain(data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load train details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <LoadingState message="Loading train details..." />;
  if (error || !train) return <ErrorState error={error} onRetry={() => navigate('/')} />;

  const isDelayed = train.currentDelayMin > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Back Navigation */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      {/* ═══════════════ HERO CARD ═══════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-[#111827] animate-fade-in-up">
        <div className="absolute inset-0 mesh-gradient pointer-events-none" />
        <div className="absolute top-6 right-8 opacity-[0.04] dark:opacity-[0.06] pointer-events-none">
          <Train className="w-48 h-48 text-blue-600" />
        </div>

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25">
                  <Train className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-mono text-lg font-black text-blue-600 dark:text-blue-400">
                    {train.number}
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    {train.name}
                  </h1>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{train.source}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                <span>{train.destination}</span>
              </p>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Source: {train.dataSource}</span>
                {train.lastUpdated && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-xs">Updated: {new Date(train.lastUpdated).toLocaleTimeString()}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  train.dataStatus === 'LIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                  train.dataStatus === 'STALE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}>
                  {train.dataStatus}
                </span>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
                !isDelayed
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                  : train.currentDelayMin <= 10
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40'
              }`}>
                {train.status}
              </span>
              <button
                onClick={() => navigate(`/tracking/${train.id}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                <Radio className="w-3.5 h-3.5" />
                Live Track
              </button>
            </div>
          </div>
        </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100/60 dark:border-slate-800/40">
            {[
              { icon: MapPin, label: 'Current Location', value: train.currentStation, sub: train.currentStationCode, color: 'from-blue-500 to-indigo-600' },
              { icon: Navigation, label: 'Next Station', value: train.nextStation, sub: train.nextStationCode, color: 'from-violet-500 to-purple-600' },
              { 
                icon: Gauge, 
                label: 'Current Speed', 
                value: (train.speed ?? train.currentSpeed) != null ? `${train.speed ?? train.currentSpeed} km/h` : 'Speed unavailable', 
                sub: (train.speed ?? train.currentSpeed) === 0 ? 'Stationary' : ((train.speed ?? train.currentSpeed) != null ? 'Live Speed' : 'Not Reported'), 
                color: 'from-cyan-500 to-blue-600' 
              },
              { icon: Clock, label: 'Current Delay', value: train.currentDelayMin < 0 ? `${Math.abs(train.currentDelayMin)} min ahead` : (train.currentDelayMin > 0 ? `${train.currentDelayMin} min late` : 'On time'), sub: train.currentDelayMin < 0 ? 'Ahead of Schedule' : (train.currentDelayMin > 0 ? 'Delayed' : 'On Schedule'), color: train.currentDelayMin < 0 ? 'from-emerald-500 to-teal-600' : (train.currentDelayMin > 0 ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-teal-600') },
            ].map(({ icon: I, label, value, sub, color }) => (
              <div key={label} className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-700/30">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md mb-2`}>
                  <I className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {label}
                </span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                  {value}
                </p>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ETA Prediction */}
      <section className="animate-fade-in-up-2">
        <ETACard
          nextStation={train.nextStation}
          scheduledTime={train.scheduledArrivalAtNext}
          predictedTime={train.predictedArrivalAtNext}
          delayMin={train.currentDelayMin}
          confidence={train.predictionConfidence}
          predictionType={train.predictionType}
          baselineTime={train.baselineEta}
          baselineDelay={train.baselineDelay}
        />
      </section>

      {/* Timeline */}
      <section className="animate-fade-in-up-3">
        <StationTimeline
          timeline={train.timeline}
          trainNumber={train.number}
          currentStationCode={train.currentStationCode}
          nextStationCode={train.nextStationCode}
          dataSource={train.dataSource}
        />
      </section>
    </div>
  );
}
