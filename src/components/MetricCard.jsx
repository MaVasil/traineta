// TrainETA Metric Card — Animated with gradient accents
import React, { useEffect, useRef, useState } from 'react';

export function MetricCard({ title, value, subtitle, icon: Icon, variant = 'default', badge }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  // Animate number counting for numeric values
  useEffect(() => {
    const numVal = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    const prevNum = parseFloat(String(prevRef.current).replace(/[^0-9.-]/g, ''));
    
    if (!isNaN(numVal) && !isNaN(prevNum) && numVal !== prevNum) {
      const duration = 600;
      const start = Date.now();
      const prefix = String(value).match(/^[^0-9]*/)?.[0] || '';
      const suffix = String(value).match(/[^0-9.]*$/)?.[0] || '';
      
      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = prevNum + (numVal - prevNum) * eased;
        
        if (Number.isInteger(numVal)) {
          setDisplayed(`${prefix}${Math.round(current)}${suffix}`);
        } else {
          setDisplayed(`${prefix}${current.toFixed(1)}${suffix}`);
        }
        
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    } else {
      setDisplayed(value);
    }
    prevRef.current = value;
  }, [value]);

  const variants = {
    blue: {
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      iconText: 'text-white',
      glow: 'group-hover:shadow-blue-500/20',
      accent: 'from-blue-500/10 to-transparent',
      badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      iconText: 'text-white',
      glow: 'group-hover:shadow-amber-500/20',
      accent: 'from-amber-500/10 to-transparent',
      badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
    },
    success: {
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      iconText: 'text-white',
      glow: 'group-hover:shadow-emerald-500/20',
      accent: 'from-emerald-500/10 to-transparent',
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
    },
    default: {
      iconBg: 'bg-gradient-to-br from-slate-500 to-slate-700',
      iconText: 'text-white',
      glow: 'group-hover:shadow-slate-500/15',
      accent: 'from-slate-500/5 to-transparent',
      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    },
  };

  const v = variants[variant] || variants.default;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 card-lift transition-all ${v.glow}`}>
      {/* Gradient accent overlay */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${v.accent} rounded-bl-full pointer-events-none opacity-60`} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
            {title}
          </p>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono animate-count">
            {displayed}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={`w-10 h-10 rounded-xl ${v.iconBg} flex items-center justify-center shadow-lg`}>
            <Icon className={`w-5 h-5 ${v.iconText}`} />
          </div>
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${v.badge}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
