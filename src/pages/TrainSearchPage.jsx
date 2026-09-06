// TrainETA Search Page — Premium with animated search and filter chips
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Train,
  X,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { trainApi } from '../services/api';
import { TrainCard } from '../components/TrainCard';
import { LoadingState, ErrorState } from '../components/LoadingState';

export function TrainSearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      const data = await trainApi.searchTrains(query, filters);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [query, statusFilter]);

  const statusOptions = [
    { value: 'all', label: 'All Trains', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
    { value: 'ontime', label: 'On Time', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    { value: 'minor', label: 'Minor Delay', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    { value: 'major', label: 'Major Delay', color: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Search Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Search className="w-4 h-4" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Search Trains
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Find trains by number, name, station, or route across the Southern Railway corridor
        </p>
      </div>

      {/* Search Input */}
      <div className="relative animate-fade-in-up-1">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by train number, name, or station..."
          className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 animate-fade-in-up-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter:
        </div>
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              statusFilter === opt.value
                ? `${opt.color} shadow-sm`
                : 'bg-transparent border-slate-200/60 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <LoadingState message="Searching trains..." />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchResults} />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-4">
            <Train className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">No trains found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Try a different search term or adjust the filters
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in-up-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {results.length} train{results.length !== 1 ? 's' : ''} found
            </span>
            {query && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Showing results for "<span className="font-bold text-slate-600 dark:text-slate-300">{query}</span>"
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((train, i) => (
              <div key={train.id} className={`animate-fade-in-up-${Math.min(i + 1, 5)}`}>
                <TrainCard train={train} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
