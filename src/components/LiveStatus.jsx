// TrainETA Live Status Telemetry Bar Component
import React from 'react';
import { Radio, Gauge, Clock, MapPin, Play, Pause, RotateCcw } from 'lucide-react';

export function LiveStatus({
  currentSpeed = null,
  currentDelayMin = 0,
  nextStation = 'Vijayawada',
  dataStatus = 'LIVE',
  dataSource = 'SIMULATED',
  isSimulating = true,
  onToggleSimulate,
  onStepSimulate,
  onResetSimulate,
}) {
  const isDelayed = currentDelayMin > 0;
  const isAhead = currentDelayMin < 0;

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Live status badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-xs ${
            dataStatus === 'LIVE' ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' :
            dataStatus === 'STALE' ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' :
            'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            <span className="relative flex h-2.5 w-2.5">
              {dataStatus === 'LIVE' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dataStatus === 'LIVE' ? 'bg-emerald-600' : (dataStatus === 'STALE' ? 'bg-amber-500' : 'bg-slate-500')}`} />
            </span>
            <span className="tracking-wider">{dataStatus} TELEMETRY</span>
          </div>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            Source: {dataSource}
          </span>
        </div>

        {/* Telemetry Metrics: Speed, Delay, Next Stop */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block leading-none">
                Current Speed
              </span>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {currentSpeed != null ? `${currentSpeed} km/h` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block leading-none">
                Current Delay
              </span>
              <span
                className={`font-mono text-sm font-bold ${
                  isAhead ? 'text-emerald-600 dark:text-emerald-400' : (isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')
                }`}
              >
                {isAhead ? `${Math.abs(currentDelayMin)} min early` : (isDelayed ? `+${currentDelayMin} min` : 'On Time')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block leading-none">
                Next Station
              </span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {nextStation}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Simulation Controls */}
        {onToggleSimulate && (
          <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onToggleSimulate}
              title={isSimulating ? 'Pause live movement' : 'Start live movement'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isSimulating
                  ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? 'Pause' : 'Simulate'}</span>
            </button>

            {onResetSimulate && (
              <button
                type="button"
                onClick={onResetSimulate}
                title="Reset simulation position"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
