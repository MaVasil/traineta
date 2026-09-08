// TrainETA Train Card — Premium with gradient hover, progress bar, and micro-animations
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Train,
  ArrowRight,
  MapPin,
  Gauge,
  Clock,
  ChevronRight,
  Radio,
  Sparkles,
} from 'lucide-react';

export function TrainCard({ train }) {
  const navigate = useNavigate();

  const getStatusConfig = (statusType, delayMin) => {
    if (delayMin < 0) {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200/80 dark:border-emerald-800/50',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: `${Math.abs(delayMin)}m EARLY`,
        glow: 'group-hover:shadow-emerald-500/10',
        progress: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      };
    }
    if (statusType === 'ontime' || delayMin === 0) {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200/80 dark:border-emerald-800/50',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'ON TIME',
        glow: 'group-hover:shadow-emerald-500/10',
        progress: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      };
    }
    if (statusType === 'minor' || delayMin <= 10) {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200/80 dark:border-amber-800/50',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: `+${delayMin} min`,
        glow: 'group-hover:shadow-amber-500/10',
        progress: 'bg-gradient-to-r from-amber-500 to-orange-500',
      };
    }
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200/80 dark:border-rose-800/50',
      text: 'text-rose-700 dark:text-rose-400',
      dot: 'bg-rose-500',
      label: `+${delayMin} min`,
      glow: 'group-hover:shadow-rose-500/10',
      progress: 'bg-gradient-to-r from-rose-500 to-red-600',
    };
  };

  const status = getStatusConfig(train.statusType, train.currentDelayMin);
  const progressPercent = train.totalDistanceKm && train.distanceRemainingKm
    ? Math.round(((train.totalDistanceKm - train.distanceRemainingKm) / train.totalDistanceKm) * 100)
    : 45;

  const handleCardClick = () => navigate(`/train/${train.id}`);
  const handleLiveClick = (e) => { e.stopPropagation(); navigate(`/tracking/${train.id}`); };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] card-lift cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden ${status.glow}`}
    >
      {/* Subtle gradient accent in corner */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none group-hover:from-blue-500/10 transition-all duration-500" />

      {/* Top: Train Identity + Status */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Train className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                {train.number}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {train.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {(train.dataSource === 'railradar' || train.data_source === 'railradar') && (
              <div className="px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider bg-blue-100/60 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300/60 dark:border-blue-700/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                RailRadar Live
              </div>
            )}
            <div className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${
              train.dataStatus === 'LIVE' ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50' :
              train.dataStatus === 'STALE' ? 'bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50' :
              'bg-slate-100/50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50'
            }`}>
              {train.dataStatus || 'LIVE'}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${status.bg} ${status.border} ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${train.currentDelayMin === 0 ? '' : 'animate-pulse'}`} />
              <span>{status.label}</span>
            </div>
          </div>
        </div>

        {/* Route Line */}
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
          <span>{train.source.split(' ')[0]}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span>{train.destination.split(' ')[0]}</span>
        </p>

        {/* Route Progress Bar */}
        <div className="mt-3 mb-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1">
            <span>Journey Progress</span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${status.progress} animate-progress transition-all duration-1000`}
              style={{ '--progress': `${progressPercent}%`, width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Grid Metrics */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-500" />
              LOCATION
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {train.currentStation}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
              <Gauge className="w-3 h-3" />
              {train.currentSpeed != null ? `${train.currentSpeed} km/h` : 'N/A'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              ETA
            </span>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {train.predictedArrivalAtNext}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
              <span className="text-slate-400">Sched:</span> {train.scheduledArrivalAtNext}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between">
        <button
          type="button"
          onClick={handleLiveClick}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors focus:outline-none"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Live Tracking</span>
        </button>

        <div className="flex items-center gap-1.5">
          {train.predictionType === 'ML' && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />
              ML
            </span>
          )}
          <span className="text-slate-300 dark:text-slate-700 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
}
