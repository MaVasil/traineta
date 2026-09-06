// TrainETA History Page — Premium data table with accuracy visualization
import React, { useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import { trainApi } from '../services/api';
import { LoadingState, ErrorState } from '../components/LoadingState';

export function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [trainFilter, setTrainFilter] = useState('all');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trainApi.getHistory({
        search: searchTerm,
        trainNumber: trainFilter,
      });
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [searchTerm, trainFilter]);

  const uniqueTrains = [...new Set(logs.map((l) => l.trainNumber || l.train_number))].filter(Boolean);

  const getAccuracyBadge = (errorMin) => {
    const err = typeof errorMin === 'number' ? errorMin : 0;
    if (err <= 1) return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/60 dark:border-emerald-800/40', label: 'Excellent' };
    if (err <= 3) return { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200/60 dark:border-blue-800/40', label: 'Good' };
    if (err <= 5) return { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/60 dark:border-amber-800/40', label: 'Fair' };
    return { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200/60 dark:border-rose-800/40', label: 'Off' };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <HistoryIcon className="w-4 h-4" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Prediction History
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Historical ETA prediction accuracy — comparing ML predictions vs actual arrivals
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up-1">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by train or station..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <select
          value={trainFilter}
          onChange={(e) => setTrainFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <option value="all">All Trains</option>
          {uniqueTrains.map((tn) => (
            <option key={tn} value={tn}>Train #{tn}</option>
          ))}
        </select>
      </div>

      {/* Results Table */}
      {loading ? (
        <LoadingState message="Loading prediction history..." />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchHistory} />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] overflow-hidden animate-fade-in-up-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Train</th>
                  <th className="py-3.5 px-5">Station</th>
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5">Scheduled</th>
                  <th className="py-3.5 px-5">Predicted</th>
                  <th className="py-3.5 px-5">Actual</th>
                  <th className="py-3.5 px-5">Error</th>
                  <th className="py-3.5 px-5">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/60">
                {logs.map((log, i) => {
                  const trainNum = log.trainNumber || log.train_number || '';
                  const trainName = log.trainName || log.train_name || '';
                  const station = log.station || log.station_name || '';
                  const stCode = log.stationCode || log.station_code || '';
                  const errMin = log.predictionErrorMin ?? log.prediction_error ?? 0;
                  const accuracy = getAccuracyBadge(errMin);

                  return (
                    <tr key={log.id || i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-5">
                        <div>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{trainNum}</span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{trainName}</p>
                        </div>
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-700 dark:text-slate-200">
                        {station}
                        {stCode && <span className="text-slate-400 ml-1">({stCode})</span>}
                      </td>
                      <td className="py-3 px-5 font-mono text-slate-500 dark:text-slate-400">{log.date || log.journey_date || '--'}</td>
                      <td className="py-3 px-5 font-mono font-bold text-slate-700 dark:text-slate-300">{log.scheduledArrival || log.scheduled_arrival || '--'}</td>
                      <td className="py-3 px-5 font-mono font-bold text-blue-600 dark:text-blue-400">{log.predictedArrival || log.predicted_arrival || '--'}</td>
                      <td className="py-3 px-5 font-mono font-bold text-slate-900 dark:text-white">{log.actualArrival || log.actual_arrival || '--'}</td>
                      <td className="py-3 px-5">
                        <span className={`font-mono font-bold ${errMin === 0 ? 'text-emerald-600 dark:text-emerald-400' : errMin <= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          ±{errMin}m
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${accuracy.bg} ${accuracy.text} ${accuracy.border}`}>
                          {accuracy.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No history records found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
