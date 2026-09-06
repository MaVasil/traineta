// TrainETA Quick Search Component
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Train, ArrowRight } from 'lucide-react';

export function TrainSearch({ initialValue = '', onSearch, placeholder = 'Search train number or train name (e.g. 12401, Demo Express)...' }) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    } else {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  const quickPicks = [
    { label: '12401 Demo Express', query: '12401' },
    { label: '12605 South Corridor', query: '12605' },
    { label: '12760 Coastal Superfast', query: '12760' },
  ];

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center shadow-xs">
        <div className="absolute left-4 pointer-events-none text-slate-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (onSearch) onSearch(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full pl-12 pr-28 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base font-medium transition-all shadow-xs"
        />
        <button
          type="submit"
          className="absolute right-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        >
          <span>Search</span>
          <ArrowRight className="w-4 h-4 hidden sm:inline" />
        </button>
      </form>

      {/* Quick suggestions pills */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Popular:
        </span>
        {quickPicks.map((pick) => (
          <button
            key={pick.query}
            type="button"
            onClick={() => {
              setSearchTerm(pick.query);
              if (onSearch) {
                onSearch(pick.query);
              } else {
                navigate(`/search?q=${encodeURIComponent(pick.query)}`);
              }
            }}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors font-mono font-medium"
          >
            {pick.label}
          </button>
        ))}
      </div>
    </div>
  );
}
