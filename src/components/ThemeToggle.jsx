// TrainETA Theme Toggle Component
// Supports Light, Dark, and System modes with accessible controls
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle({ theme, setTheme, compact = false }) {
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  if (compact) {
    const currentOption = options.find((o) => o.value === theme) || options[2];
    const CurrentIcon = currentOption.icon;

    const handleCycle = () => {
      if (theme === 'light') setTheme('dark');
      else if (theme === 'dark') setTheme('system');
      else setTheme('light');
    };

    return (
      <button
        type="button"
        onClick={handleCycle}
        title={`Theme: ${currentOption.label} (click to cycle)`}
        aria-label={`Switch theme (current: ${currentOption.label})`}
        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700/80 shadow-xs"
      >
        <CurrentIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(opt.value)}
            title={`Switch to ${opt.label} mode`}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
