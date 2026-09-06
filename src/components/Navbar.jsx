// TrainETA Primary Navigation Bar — Glassmorphic Premium Design
import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Train,
  Search,
  Activity,
  History,
  Shield,
  Menu,
  X,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { getApiConnectionStatus } from '../services/api';

export function Navbar({ theme, setTheme }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connStatus, setConnStatus] = useState(getApiConnectionStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setConnStatus(getApiConnectionStatus());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: Activity, end: true },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/tracking/12401', label: 'Live Tracking', icon: Radio },
    { to: '/history', label: 'History', icon: History },
    { to: '/admin', label: 'Admin', icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/50 dark:border-slate-800/50 glass-strong transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:shadow-blue-600/50 transition-shadow">
                <Train className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                  TrainETA
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase mt-0.5">
                  Railway Intelligence
                </span>
              </div>
            </Link>

            {/* Connection Status Badge */}
            <div className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold ${
              connStatus.connected
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/40 text-amber-700 dark:text-amber-400'
            }`}>
              {connStatus.connected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Backend Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>Demo Mode</span>
                </>
              )}
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Theme Switcher & Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} setTheme={setTheme} />

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/50 dark:border-slate-800/50 glass px-4 pt-2 pb-4 space-y-1 shadow-xl animate-fade-in-up">
          <div className={`py-2 px-3 mb-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            connStatus.connected
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
          }`}>
            {connStatus.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connStatus.connected ? 'Backend Connected' : 'Demo Mode — Simulated Data'}
          </div>
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </header>
  );
}
