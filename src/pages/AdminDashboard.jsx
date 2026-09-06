// TrainETA Admin Operations Command Dashboard — Premium with gradient charts
import React, { useEffect, useState } from 'react';
import {
  Shield,
  Train,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart3,
  Server,
  Activity,
  ArrowUpRight,
  Radio,
  RotateCcw,
  Cpu,
  Zap,
  Database,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { trainApi } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { LoadingState, ErrorState } from '../components/LoadingState';

export function AdminDashboard({ isDark = false }) {
  const [analytics, setAnalytics] = useState(null);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [analyticsData, trainList] = await Promise.all([
        trainApi.getAdminAnalytics(),
        trainApi.getTrains(),
      ]);
      setAnalytics(analyticsData);
      setTrains(trainList);
    } catch (err) {
      setError(err.message || 'Failed to load operational telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdminData(); }, []);

  if (loading) return <LoadingState message="Connecting to Railway Operations Center..." />;
  if (error || !analytics) return <ErrorState error={error} onRetry={fetchAdminData} />;

  const { metrics, accuracyTrend, delayDistribution, statusShare, stationDelays } = analytics;

  const tooltipStyle = {
    backgroundColor: isDark ? '#111827' : '#FFFFFF',
    borderColor: isDark ? '#374151' : '#E2E8F0',
    borderRadius: '12px',
    fontSize: '12px',
    color: isDark ? '#FFFFFF' : '#000000',
    boxShadow: '0 8px 32px -4px rgba(0,0,0,0.12)',
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="relative overflow-hidden p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-[#111827] animate-fade-in-up">
        <div className="absolute inset-0 mesh-gradient pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Operations Control Center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Corridor Network & ML Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Zone: South Central Railway • Corridor: Hyderabad Deccan ⇄ Chennai Central
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Systems Online</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40 text-xs font-bold text-violet-700 dark:text-violet-400">
              <Sparkles className="w-3 h-3" />
              <span>ML Engine</span>
            </div>
            <button
              type="button"
              onClick={fetchAdminData}
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ METRICS ═══════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up-1">
        <MetricCard title="Active Trains" value={metrics.activeTrains} subtitle="Monitored on corridor" icon={Train} variant="blue" badge="Nominal" />
        <MetricCard title="Delayed Trains" value={metrics.delayedTrains} subtitle="Block or caution hold" icon={AlertTriangle} variant="warning" />
        <MetricCard title="Average Delay" value={`+${metrics.averageDelayMin} min`} subtitle="Corridor mean variance" icon={Clock} variant="default" />
        <MetricCard title="ML Accuracy" value={`${metrics.predictionAccuracyPercent}%`} subtitle={`MAE: ±${metrics.meanAbsoluteErrorMin} min`} icon={Sparkles} variant="success" />
      </div>

      {/* ═══════════════ CHARTS ROW 1 ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up-2">
        {/* Accuracy Trend */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Prediction Accuracy Trend</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Daily model performance evaluation</p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">95.8% Peak</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accuracyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F2937' : '#E2E8F0'} />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                <YAxis domain={[90, 100]} stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, 'Accuracy']} />
                <Area type="monotone" dataKey="accuracy" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#accGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delay Distribution */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delay Distribution</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Trains grouped by schedule deviation</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delayDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F2937' : '#E2E8F0'} />
                <XAxis dataKey="range" stroke="#94A3B8" fontSize={10} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {delayDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════ CHARTS ROW 2 ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up-3">
        {/* Punctuality Pie */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Fleet Punctuality</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Status distribution breakdown</p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusShare} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                  {statusShare.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Station Delays */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 text-white">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Station Average Delay</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Bottleneck identification</p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationDelays} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F2937' : '#E2E8F0'} />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} unit="m" />
                <YAxis type="category" dataKey="station" stroke="#94A3B8" fontSize={11} width={80} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`+${val} min`, 'Avg Delay']} />
                <Bar dataKey="avgDelay" fill="#2563EB" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════ FLEET TABLE ═══════════════ */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] overflow-hidden animate-fade-in-up-4">
        <div className="p-5 border-b border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Fleet Dispatch</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Live units with position and block reservation</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/40 font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-[10px]">
              <tr>
                <th className="py-3.5 px-5">Train</th>
                <th className="py-3.5 px-5">Current Block</th>
                <th className="py-3.5 px-5">Speed</th>
                <th className="py-3.5 px-5">Delay</th>
                <th className="py-3.5 px-5">Next Target</th>
                <th className="py-3.5 px-5">ETA</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
              {trains.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{t.number}</span>
                      <span className="text-slate-900 dark:text-white">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 font-medium">{t.currentStation} ({t.currentStationCode})</td>
                  <td className="py-3.5 px-5 font-mono">{t.currentSpeed} km/h</td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      t.currentDelayMin === 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                    }`}>
                      {t.currentDelayMin === 0 ? 'On Time' : `+${t.currentDelayMin}m`}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-medium">{t.nextStation}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-slate-900 dark:text-white">{t.predictedArrivalAtNext}</td>
                  <td className="py-3.5 px-5 text-right">
                    <a href={`/tracking/${t.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                      <span>Track</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
