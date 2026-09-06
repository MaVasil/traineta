// TrainETA Next Arrival ETA Card — Premium with confidence gauge and animated display
import React, { useEffect, useState } from 'react';
import { Clock, Sparkles, MapPin, TrendingUp, Zap } from 'lucide-react';

function ConfidenceGauge({ value = 91, size = 64 }) {
  const [offset, setOffset] = useState(283);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const normalizedVal = typeof value === 'number' && value <= 1 ? value * 100 : value;

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (normalizedVal / 100) * circumference);
    }, 300);
    return () => clearTimeout(timer);
  }, [normalizedVal, circumference]);

  const color = normalizedVal >= 90 ? '#16A34A' : normalizedVal >= 75 ? '#2563EB' : normalizedVal >= 60 ? '#F59E0B' : '#DC2626';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="gauge-ring"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black font-mono text-slate-900 dark:text-white">{Math.round(normalizedVal)}%</span>
      </div>
    </div>
  );
}

export function ETACard({
  nextStation = 'Vijayawada',
  scheduledTime = '22:36',
  predictedTime = '22:42',
  delayMin = 6,
  confidence = 91,
  predictionType = 'ML',
  baselineTime = null,
  baselineDelay = null,
}) {
  const isDelayed = delayMin > 0;
  const confValue = typeof confidence === 'number' && confidence <= 1 ? Math.round(confidence * 100) : confidence;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 dark:border-blue-600/30 bg-white dark:bg-[#111827] shadow-lg shadow-blue-500/5 animate-scale-in">
      {/* Gradient accent background */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-500/8 via-indigo-500/4 to-transparent rounded-bl-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-violet-500/5 to-transparent rounded-tr-full pointer-events-none" />

      <div className="relative z-10 p-6 sm:p-7">
        {/* Top Banner */}
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                NEXT ARRIVAL
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-sm font-bold text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <span>Approaching</span>
                <span className="text-slate-900 dark:text-white font-extrabold">
                  {nextStation}
                </span>
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            predictionType === 'ML' 
              ? 'bg-violet-50/80 dark:bg-violet-950/40 border-violet-200/80 dark:border-violet-800/50 text-violet-700 dark:text-violet-400'
              : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
          }`}>
            {predictionType === 'ML' ? <Sparkles className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            <span>{predictionType === 'ML' ? 'ML Prediction' : 'Baseline'}</span>
          </div>
        </div>

        {/* Main Display: Large Time + Confidence Gauge */}
        <div className="flex items-end justify-between gap-4 my-4">
          <div>
            <span className="text-5xl sm:text-6xl lg:text-7xl font-black font-mono tracking-tight text-slate-900 dark:text-white leading-none">
              {predictedTime}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Predicted ETA
              </span>
              {isDelayed && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[11px] font-bold border border-amber-200/80 dark:border-amber-800/40">
                  +{delayMin} min late
                </span>
              )}
              {!isDelayed && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200/80 dark:border-emerald-800/40">
                  On Schedule
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <ConfidenceGauge value={confValue} size={72} />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Confidence
            </span>
          </div>
        </div>

        {/* Sub-metrics Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-700/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Scheduled
            </span>
            <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
              {scheduledTime}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-800/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">
              {predictionType === 'ML' ? 'ML Predicted' : 'Predicted'}
            </span>
            <p className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {predictedTime}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-700/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Expected Delay
            </span>
            <p className={`text-base font-bold font-mono mt-1 ${
              isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {isDelayed ? `+${delayMin} min` : '0 min'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-700/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {predictionType === 'ML' && baselineTime ? 'Baseline ETA' : 'Model Score'}
            </span>
            <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
              {predictionType === 'ML' && baselineTime ? `${baselineTime}` : `${confValue}%`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
