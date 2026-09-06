// TrainETA Loading & Error States — Premium animated states
import React from 'react';
import { Train, AlertTriangle, RotateCcw, WifiOff } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-28 animate-fade-in-up">
      {/* Animated train loader */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/25 animate-pulse">
          <Train className="w-8 h-8 text-white" />
        </div>
        {/* Orbiting dot */}
        <div className="absolute -inset-3">
          <div className="w-full h-full rounded-full border-2 border-transparent border-t-blue-500 animate-spin" style={{ animationDuration: '1.5s' }} />
        </div>
      </div>

      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
        {message}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Establishing secure connection to railway corridor...
      </p>
      
      {/* Loading bar */}
      <div className="mt-4 w-48 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shimmer" 
          style={{ animation: 'shimmer 1.5s ease-in-out infinite, progressFill 2s ease-out forwards' }} 
        />
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-28 animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl shadow-rose-500/25 mb-5">
        <WifiOff className="w-8 h-8 text-white" />
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
        Connection Issue
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-5">
        {error || 'Unable to reach the railway telemetry feed. This may be a temporary network issue.'}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
