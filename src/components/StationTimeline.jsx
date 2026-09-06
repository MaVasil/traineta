// TrainETA Station Timeline — Premium vertical timeline with animated progress
import React from 'react';
import { CheckCircle2, Circle, MapPin, Clock, ChevronDown } from 'lucide-react';

const DEFAULT_TIMELINE = [
  { code: 'HYB', name: 'Hyderabad Deccan', state: 'completed', scheduledArr: '--', scheduledDep: '18:15', actualArr: '--', actualDep: '18:15', platform: 'Pf 4', delayMin: 0 },
  { code: 'KZJ', name: 'Kazipet Junction', state: 'completed', scheduledArr: '20:18', scheduledDep: '20:20', actualArr: '20:18', actualDep: '20:20', platform: 'Pf 2', delayMin: 0 },
  { code: 'WL', name: 'Warangal', state: 'current', scheduledArr: '20:38', scheduledDep: '20:40', actualArr: '20:38', actualDep: '20:40', platform: 'Pf 1', delayMin: 0 },
  { code: 'BZA', name: 'Vijayawada Jn', state: 'upcoming', scheduledArr: '22:36', scheduledDep: '22:45', actualArr: '--', actualDep: '--', platform: 'Pf 6', delayMin: 0 },
  { code: 'MAS', name: 'Chennai Central', state: 'upcoming', scheduledArr: '05:45', scheduledDep: '--', actualArr: '--', actualDep: '--', platform: 'Pf 3', delayMin: 0 },
];

export function StationTimeline({ timeline, currentStationCode }) {
  const items = timeline && timeline.length > 0 ? timeline : DEFAULT_TIMELINE;

  const getStationState = (item) => {
    if (item.state) return item.state;
    if (item.status === 'COMPLETED') return 'completed';
    if (item.status === 'CURRENT') return 'current';
    return 'upcoming';
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Route Station Timeline
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
          {items.length} stops
        </span>
      </div>

      {/* Timeline Body */}
      <div className="px-6 py-5">
        <div className="relative">
          {items.map((item, index) => {
            const state = getStationState(item);
            const isLast = index === items.length - 1;
            const code = item.code || item.station_code;
            const name = item.name || item.station_name;
            const isCurrent = state === 'current' || code === currentStationCode;
            const isCompleted = state === 'completed';
            const isUpcoming = state === 'upcoming';
            const delay = item.delayMin || 0;

            return (
              <div key={code || index} className="relative flex gap-4" style={{ animationDelay: `${index * 0.08}s` }}>
                {/* Vertical Line + Node */}
                <div className="flex flex-col items-center">
                  {/* Station Node */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                    isCurrent
                      ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30 pulse-glow'
                      : isCompleted
                        ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                  }`}>
                    {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                    {isCurrent && (
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                      </div>
                    )}
                    {isUpcoming && <Circle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                  </div>
                  
                  {/* Connecting Line */}
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[3rem] ${
                      isCompleted ? 'bg-emerald-400 dark:bg-emerald-600' :
                      isCurrent ? 'bg-gradient-to-b from-blue-500 to-slate-200 dark:to-slate-700' :
                      'bg-slate-200 dark:bg-slate-700'
                    }`} />
                  )}
                </div>

                {/* Station Info Card */}
                <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <div className={`rounded-xl p-3.5 border transition-all ${
                    isCurrent
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40'
                      : isCompleted
                        ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100/60 dark:border-slate-800/40'
                        : 'bg-slate-50/30 dark:bg-slate-800/20 border-slate-100/40 dark:border-slate-800/30'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                            isCurrent ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' :
                            isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {code}
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {name}
                          </span>
                        </div>
                        {item.platform && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                            {item.platform}
                          </span>
                        )}
                      </div>

                      {delay > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/30">
                          +{delay}m
                        </span>
                      )}
                    </div>

                    {/* Time Info */}
                    <div className="mt-2 flex items-center gap-4 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400">Arr:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item.scheduledArr || item.scheduled_arrival || '--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 dark:text-slate-400">Dep:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item.scheduledDep || item.scheduled_departure || '--'}
                        </span>
                      </div>
                      {(item.actualArr && item.actualArr !== '--') && (
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-500">Actual:</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {item.actualArr}
                          </span>
                        </div>
                      )}
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
