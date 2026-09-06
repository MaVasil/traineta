// TrainETA Delay Analysis Card Component
import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export function DelayCard({ delayMin = 0, breakdown = [] }) {
  const isDelayed = delayMin > 0;

  const defaultFactors = breakdown.length > 0 ? breakdown : [
    { reason: 'Section Line Clearance', impactMin: delayMin > 2 ? 2 : delayMin, type: 'normal' },
    { reason: 'Signal Aspect Wait', impactMin: Math.max(0, delayMin - 2), type: 'warning' },
  ];

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-md ${
              isDelayed
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isDelayed ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Delay Attribution & Root Cause
          </h4>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
            isDelayed
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {isDelayed ? `Total Delay: +${delayMin} min` : 'Nominal Schedule'}
        </span>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {isDelayed
          ? 'Predictive models isolated the following environmental and operational bottlenecks contributing to runtime variance:'
          : 'Train is running within expected tolerance corridor. No active cautions or signal holds detected on block sections.'}
      </p>

      {/* Delay Factor Breakdown List */}
      <div className="space-y-2.5">
        {defaultFactors.map((factor, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  factor.type === 'critical'
                    ? 'bg-rose-500'
                    : factor.type === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {factor.reason}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              +{factor.impactMin} min
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
