// TrainETA Station Timeline — Dynamic Route Progression from Real RailRadar Halts
import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  MapPin,
  Clock,
  Navigation,
  Radio,
  Layers,
  Info,
  Gauge,
  Route,
} from 'lucide-react';

export function StationTimeline({
  timeline,
  trainNumber,
  currentStationCode,
  nextStationCode,
  dataSource = 'railradar',
}) {
  const [filterMode, setFilterMode] = useState('commercial'); // 'commercial' | 'all'

  const items = useMemo(() => {
    return Array.isArray(timeline) ? timeline : [];
  }, [timeline]);

  // Counts for toggle tabs
  const commercialCount = useMemo(() => {
    return items.filter((i) => i.isHalt !== false && i.is_halt !== false).length;
  }, [items]);

  const allCount = items.length;

  // Filtered station list based on toggle
  const displayedItems = useMemo(() => {
    if (filterMode === 'all') return items;
    // Commercial stops mode: keep halts, plus preserve current/next station if operational
    return items.filter((item) => {
      const isCommercial = item.isHalt !== false && item.is_halt !== false;
      const code = (item.code || item.station_code || '').toUpperCase();
      const isCurrent = currentStationCode && code === currentStationCode.toUpperCase();
      const isNext = nextStationCode && code === nextStationCode.toUpperCase();
      return isCommercial || isCurrent || isNext;
    });
  }, [items, filterMode, currentStationCode, nextStationCode]);

  // If no timeline data is available, show clean empty state (no fake fallback)
  if (!items || items.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-8 text-center animate-fade-in-up">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
          <Route className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Route Station Timeline Unavailable
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Live halt progression telemetry has not been reported for train #{trainNumber || 'this train'}.
          Operational timeline will populate automatically once telemetry signals are detected.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] overflow-hidden shadow-sm animate-fade-in-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100/80 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Route Station Timeline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Train #{trainNumber || 'N/A'}</span>
              <span>•</span>
              <span className="capitalize font-mono">{dataSource || 'railradar'} halts</span>
            </p>
          </div>
        </div>

        {/* Commercial vs All Waypoints Filter Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/50 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterMode('commercial')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'commercial'
                ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Commercial Stops ({commercialCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Waypoints ({allCount})
          </button>
        </div>
      </div>

      {/* Timeline Progression Body */}
      <div className="px-6 py-6 max-h-[600px] overflow-y-auto custom-scrollbar">
        <div className="relative">
          {displayedItems.map((item, index) => {
            const isLast = index === displayedItems.length - 1;
            const code = item.code || item.station_code || '';
            const name = item.name || item.station_name || code;
            const isHalt = item.isHalt !== false && item.is_halt !== false;

            const isCurrent =
              item.state === 'current' ||
              item.status === 'CURRENT' ||
              (currentStationCode && code.toUpperCase() === currentStationCode.toUpperCase());

            const isNext =
              !isCurrent &&
              (item.state === 'next' ||
                item.status === 'NEXT' ||
                (nextStationCode && code.toUpperCase() === nextStationCode.toUpperCase()));

            const isCompleted =
              !isCurrent &&
              !isNext &&
              (item.state === 'completed' ||
                item.status === 'COMPLETED' ||
                item.status === 'DEPARTED');

            const isUpcoming = !isCurrent && !isNext && !isCompleted;
            const delay = item.delayMin || item.delay_minutes || 0;

            return (
              <div
                key={`${code}-${item.sequence || index}`}
                className="relative flex gap-4"
                style={{ animationDelay: `${Math.min(index * 0.03, 0.4)}s` }}
              >
                {/* Vertical Column: Node Icon + Connecting Track Line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  {/* Station Node Badge */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                      isCurrent
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/20 pulse-glow'
                        : isNext
                        ? 'bg-violet-600 border-violet-400 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-500/20'
                        : isCompleted
                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isCurrent && (
                      <div className="relative flex items-center justify-center">
                        <Radio className="w-4 h-4 animate-pulse" />
                      </div>
                    )}
                    {isNext && <Navigation className="w-3.5 h-3.5 transform rotate-45" />}
                    {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                    {isUpcoming && <Circle className="w-3 h-3" />}
                  </div>

                  {/* Connecting Line */}
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[3.25rem] ${
                        isCompleted
                          ? 'bg-emerald-400 dark:bg-emerald-600'
                          : isCurrent
                          ? 'bg-gradient-to-b from-blue-500 via-indigo-400 to-slate-200 dark:to-slate-700'
                          : isNext
                          ? 'bg-gradient-to-b from-violet-500 to-slate-200 dark:to-slate-700'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  )}
                </div>

                {/* Station Details Card */}
                <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <div
                    className={`rounded-2xl p-4 border transition-all ${
                      isCurrent
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700/60 shadow-sm ring-1 ring-blue-400/30'
                        : isNext
                        ? 'bg-violet-50/60 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40'
                        : isCompleted
                        ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50'
                        : 'bg-slate-50/30 dark:bg-slate-800/20 border-slate-100/50 dark:border-slate-800/30'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Station Code Badge */}
                          <span
                            className={`font-mono text-xs font-black px-2 py-0.5 rounded-md ${
                              isCurrent
                                ? 'bg-blue-600 text-white'
                                : isNext
                                ? 'bg-violet-600 text-white'
                                : isCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {code}
                          </span>

                          {/* Station Name */}
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {name}
                          </span>

                          {/* Operational vs Commercial pill */}
                          {!isHalt && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                              Waypoint
                            </span>
                          )}

                          {/* Status Pill Tag */}
                          {isCurrent && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Current Station
                            </span>
                          )}
                          {isNext && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                              Next Stop
                            </span>
                          )}
                        </div>

                        {/* Metadata row: Platform & Distance */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {item.platform && (
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {item.platform}
                            </span>
                          )}
                          {item.distance != null && item.distance > 0 && (
                            <span>{item.distance.toFixed(1)} km</span>
                          )}
                          {item.speed_to_next_kmph != null && item.speed_to_next_kmph > 0 && (
                            <span className="flex items-center gap-1">
                              <Gauge className="w-3 h-3 text-slate-400" />
                              {Math.round(item.speed_to_next_kmph)} km/h
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delay Tag if applicable */}
                      {delay !== 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            delay > 0
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/30'
                              : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/30'
                          }`}
                        >
                          {delay > 0 ? `+${delay}m` : `${delay}m`}
                        </span>
                      )}
                    </div>

                    {/* Scheduled & Actual Times Row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Arr */}
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-400 dark:text-slate-500">Arr:</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.scheduledArr || item.scheduled_arrival || '--'}
                          </span>
                        </div>

                        {/* Dep */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 dark:text-slate-500">Dep:</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.scheduledDep || item.scheduled_departure || '--'}
                          </span>
                        </div>
                      </div>

                      {/* Actual time if recorded */}
                      {(item.actualArr && item.actualArr !== '--') ||
                      (item.actualDep && item.actualDep !== '--') ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Actual:
                          </span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {item.actualArr !== '--' ? item.actualArr : item.actualDep}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
