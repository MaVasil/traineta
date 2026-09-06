// TrainETA Main Application Entry Component
import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Navbar } from './components/Navbar';
import { useTheme } from './hooks/useTheme';

import { Dashboard } from './pages/Dashboard';
import { TrainSearchPage } from './pages/TrainSearchPage';
import { TrainDetails } from './pages/TrainDetails';
import { LiveTracking } from './pages/LiveTracking';
import { History } from './pages/History';
import { AdminDashboard } from './pages/AdminDashboard';
import { Train, ShieldCheck, Activity } from 'lucide-react';

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
};

function AnimatedPage({ children }) {
  return (
    <motion.div {...pageTransition}>
      {children}
    </motion.div>
  );
}

export function App() {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1220] text-slate-900 dark:text-[#F9FAFB] transition-colors duration-200 flex flex-col font-sans">
      {/* Primary Top Navigation */}
      <Navbar theme={theme} setTheme={setTheme} />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname.split('/').slice(0, 2).join('/')}>
            <Route path="/" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
            <Route path="/search" element={<AnimatedPage><TrainSearchPage /></AnimatedPage>} />
            <Route path="/train/:id" element={<AnimatedPage><TrainDetails /></AnimatedPage>} />
            <Route path="/tracking/:id" element={<AnimatedPage><LiveTracking isDark={isDark} /></AnimatedPage>} />
            <Route path="/tracking" element={<Navigate to="/tracking/12401" replace />} />
            <Route path="/history" element={<AnimatedPage><History /></AnimatedPage>} />
            <Route path="/admin" element={<AnimatedPage><AdminDashboard isDark={isDark} /></AnimatedPage>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Professional Transportation Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 glass mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-500/20">
              <Train className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">
              TrainETA
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-[11px]">Dynamic Railway Intelligence Platform</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ML Engine Active
            </span>
            <Link to="/admin" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
              Operations Center
            </Link>
            <Link to="/history" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
              Model History
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
