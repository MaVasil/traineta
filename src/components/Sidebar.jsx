// TrainETA Sidebar Navigation for Admin and Operational Dashboards
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Activity,
  Search,
  Radio,
  History,
  Shield,
  BarChart3,
  Server,
  Train,
  ArrowUpRight,
} from 'lucide-react';

export function Sidebar({ currentTrainId }) {
  const primaryLinks = [
    { to: '/', label: 'Overview Dashboard', icon: Activity, end: true },
    { to: '/search', label: 'Train Directory', icon: Search },
    {
      to: currentTrainId ? `/tracking/${currentTrainId}` : '/tracking/12401',
      label: 'Live Telemetry Map',
      icon: Radio,
    },
    { to: '/history', label: 'Arrival Accuracy History', icon: History },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Operations Command', icon: Shield, end: true },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0E1726]/60 backdrop-blur-md p-4 min-h-[calc(100vh-4rem)]">
      {/* Quick Corridor Badge */}
      <div className="p-3 mb-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Active Corridor</span>
          <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>
        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
          Hyderabad ⇄ Chennai Central
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          5 Stations • 785 km Track
        </p>
      </div>

      {/* Navigation Sections */}
      <div className="space-y-6 flex-1">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 mb-2">
            Passenger Operations
          </div>
          <nav className="space-y-1">
            {primaryLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 mb-2">
            Operations & ML
          </div>
          <nav className="space-y-1">
            {adminLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Corridor Quick Switcher */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
        <div className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold mb-2">
          Focus Trains
        </div>
        <div className="space-y-1">
          <Link
            to="/tracking/12401"
            className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 group"
          >
            <span className="font-mono text-xs font-semibold">12401 Demo Express</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
              ON TIME
            </span>
          </Link>
          <Link
            to="/tracking/12605"
            className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 group"
          >
            <span className="font-mono text-xs font-semibold">12605 South Corridor</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold">
              +6 min
            </span>
          </Link>
          <Link
            to="/tracking/12760"
            className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 group"
          >
            <span className="font-mono text-xs font-semibold">12760 Coastal Superfast</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold">
              +18 min
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
