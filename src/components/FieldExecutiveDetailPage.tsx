import React, { useState, useMemo, useEffect } from 'react';
import { WorkEntry } from '../types';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Camera,
  FileSpreadsheet,
  Presentation,
  Share2,
  Search,
  MapPin,
  Globe,
  RotateCcw,
  Trash2,
  ClipboardList,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { exportCivilWorkToExcel } from '../utils/excelExporter';
import { exportCivilWorkToPpt } from '../utils/pptExporter';

interface FieldExecutiveDetailPageProps {
  workerName: string;
  workerEmail?: string;
  workerUid?: string;
  entries: WorkEntry[];
  onBack: () => void;
  onSelectEntry: (entry: WorkEntry) => void;
  onShareSummary: (workerName: string, filteredEntries: WorkEntry[]) => void;
  onShareEntry: (entry: WorkEntry) => void;
  onOpenLightbox: (photos: string[], index: number, title: string) => void;
  onRemoveExecutive?: (workerName: string, uid?: string) => void;
}

function isEntryToday(entry: WorkEntry): boolean {
  const todayIso = new Date().toLocaleDateString('en-CA');
  const todayStr = new Date().toDateString();

  if (entry.date) {
    if (entry.date === todayIso) return true;
    const [y, m, d] = entry.date.split('-').map(Number);
    if (y && m && d) {
      const entryD = new Date(y, m - 1, d);
      if (entryD.toDateString() === todayStr) return true;
    }
  }

  if (entry.createdAt) {
    let d: Date | null = null;
    if (typeof entry.createdAt.toDate === 'function') {
      try {
        d = entry.createdAt.toDate();
      } catch {}
    } else if (entry.createdAt instanceof Date) {
      d = entry.createdAt;
    } else if (typeof entry.createdAt === 'string') {
      const parsed = new Date(entry.createdAt);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (d && d.toDateString() === todayStr) return true;
  }

  return false;
}

function isEntryOnDate(entry: WorkEntry, dateStr: string): boolean {
  if (!dateStr) return true;
  if (entry.date && entry.date === dateStr) return true;

  if (entry.createdAt) {
    let d: Date | null = null;
    if (typeof entry.createdAt.toDate === 'function') {
      try {
        d = entry.createdAt.toDate();
      } catch {}
    } else if (entry.createdAt instanceof Date) {
      d = entry.createdAt;
    } else if (typeof entry.createdAt === 'string') {
      const parsed = new Date(entry.createdAt);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (d) {
      const target = new Date(dateStr);
      return (
        d.getFullYear() === target.getFullYear() &&
        d.getMonth() === target.getMonth() &&
        d.getDate() === target.getDate()
      );
    }
  }
  return false;
}

export const FieldExecutiveDetailPage: React.FC<FieldExecutiveDetailPageProps> = ({
  workerName,
  workerEmail,
  workerUid,
  entries,
  onBack,
  onSelectEntry,
  onShareSummary,
  onShareEntry,
  onOpenLightbox,
  onRemoveExecutive,
}) => {
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Done'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [workerName]);

  const workerEntries = useMemo(() => {
    const cleanTarget = workerName.trim().toLowerCase();
    return entries.filter(
      (e) => (e.userName || '').trim().toLowerCase() === cleanTarget
    );
  }, [entries, workerName]);

  const stats = useMemo(() => {
    const total = workerEntries.length;
    const today = workerEntries.filter(isEntryToday).length;
    const done = workerEntries.filter((e) => e.status === 'Done').length;
    const pending = workerEntries.filter((e) => e.status === 'Pending').length;
    const totalPhotos = workerEntries.reduce((acc, e) => acc + (e.photos?.length || 0), 0);
    return { total, today, done, pending, totalPhotos };
  }, [workerEntries]);

  const filteredEntries = useMemo(() => {
    return workerEntries.filter((entry) => {
      if (statusFilter !== 'ALL' && entry.status !== statusFilter) {
        return false;
      }
      if (dateFilter === 'TODAY' && !isEntryToday(entry)) {
        return false;
      }
      if (dateFilter === 'CUSTOM' && customDate && !isEntryOnDate(entry, customDate)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoute = (entry.route || '').toLowerCase().includes(q);
        const matchesType = (entry.workType || '').toLowerCase().includes(q);
        const matchesLoc =
          (entry.location || '').toLowerCase().includes(q) ||
          (entry.locationFrom || '').toLowerCase().includes(q);
        const matchesLatLong = (entry.latLong || '').toLowerCase().includes(q);
        const matchesRemark = (entry.remark || '').toLowerCase().includes(q);
        if (!matchesRoute && !matchesType && !matchesLoc && !matchesLatLong && !matchesRemark) {
          return false;
        }
      }
      return true;
    });
  }, [workerEntries, statusFilter, dateFilter, customDate, searchQuery]);

  const handleExportExcel = () => {
    setExportingExcel(true);
    try {
      exportCivilWorkToExcel(entries, {
        workerFilter: workerName,
        dateFilterType:
          dateFilter === 'TODAY' ? 'TODAY' : dateFilter === 'CUSTOM' ? 'CUSTOM_DATE' : 'ALL',
        customDate: dateFilter === 'CUSTOM' ? customDate : undefined,
        statusFilter,
        groupBy: 'multi_tab_master',
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPpt = async () => {
    setExportingPpt(true);
    try {
      await exportCivilWorkToPpt(entries, {
        workerFilter: workerName,
        dateFilterType:
          dateFilter === 'TODAY' ? 'TODAY' : dateFilter === 'CUSTOM' ? 'CUSTOM_DATE' : 'ALL',
        customDate: dateFilter === 'CUSTOM' ? customDate : undefined,
        statusFilter,
        includeSummarySlide: true,
      });
    } finally {
      setExportingPpt(false);
    }
  };

  const resetLocalFilters = () => {
    setDateFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  const initials = workerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 font-sans">
      {/* Top Navigation & Responsive Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200">
        <div className="flex items-center justify-between lg:justify-start space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Dashboard</span>
          </button>
          <div className="hidden sm:flex items-center space-x-2 text-xs text-stone-500 truncate">
            <span>Field Executives</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-stone-900 truncate">{workerName}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel || filteredEntries.length === 0}
            className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>{exportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPpt}
            disabled={exportingPpt || filteredEntries.length === 0}
            className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Presentation className="w-4 h-4 shrink-0" />
            <span>{exportingPpt ? 'Generating PPT...' : 'Export to PPT'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShareSummary(workerName, filteredEntries)}
            disabled={filteredEntries.length === 0}
            className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>Share Summary</span>
          </button>

          {onRemoveExecutive && (
            <button
              type="button"
              onClick={() => onRemoveExecutive(workerName, workerUid)}
              className="min-h-[42px] inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Remove Executive"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>

      {/* Executive Profile & KPI Summary Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-200">
          <div className="flex items-center space-x-3.5 sm:space-x-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-600 text-white font-bold text-base sm:text-lg flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-stone-500 flex-wrap">
                <span>Site Field Executive</span>
                <span aria-hidden="true">·</span>
                <span className={stats.today > 0 ? 'text-emerald-700 font-semibold' : 'text-stone-500'}>
                  {stats.today > 0 ? `Active Today (${stats.today} logged)` : 'No logs submitted today'}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-stone-900 tracking-tight mt-0.5 truncate">
                {workerName}
              </h1>
              {workerEmail && (
                <div className="flex items-center space-x-1.5 text-xs text-stone-500 mt-1 truncate">
                  <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{workerEmail}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-xs text-stone-500 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <span>Total Site Photos Attached</span>
            <span className="text-base sm:text-lg font-bold text-stone-900 font-mono tabular-nums sm:mt-0.5">
              {stats.totalPhotos} Photos
            </span>
          </div>
        </div>

        {/* 4 Clean KPI Metric Boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setDateFilter('ALL');
              setStatusFilter('ALL');
            }}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              dateFilter === 'ALL' && statusFilter === 'ALL'
                ? 'bg-stone-100 border-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-stone-500 block">Total Logs</span>
            <span className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tabular-nums mt-1 block">
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDateFilter('TODAY');
              setStatusFilter('ALL');
            }}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              dateFilter === 'TODAY'
                ? 'bg-amber-50 border-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-stone-500 block">Logged Today</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1 block">
              {stats.today}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Done' ? 'ALL' : 'Done')}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              statusFilter === 'Done'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-emerald-700 block">Completed (Done)</span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1 block">
              {stats.done}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'ALL' : 'Pending')}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              statusFilter === 'Pending'
                ? 'bg-amber-50 border-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-amber-700 block">Pending Work</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1 block">
              {stats.pending}
            </span>
          </button>
        </div>
      </div>

      {/* Responsive Filter Bar for this Executive's Logs */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${workerName}'s routes, locations, GPS, or remarks...`}
            className="w-full min-h-[42px] pl-9 pr-4 py-2 text-sm rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-stretch sm:items-center gap-2">
          {/* Date Filter */}
          <div className="flex items-center gap-1.5 w-full lg:w-auto">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="flex-1 lg:flex-initial min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 text-stone-900 text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">All Dates ({stats.total})</option>
              <option value="TODAY">Today Only ({stats.today})</option>
              <option value="CUSTOM">Specific Date</option>
            </select>

            {dateFilter === 'CUSTOM' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="min-h-[42px] px-2.5 py-1.5 text-xs rounded-xl border border-stone-300 text-stone-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            )}
          </div>

          {/* Segmented Status Control */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 lg:flex-initial min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Pending')}
              className={`flex-1 lg:flex-initial min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'Pending'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Done')}
              className={`flex-1 lg:flex-initial min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'Done'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Done ({stats.done})
            </button>
          </div>

          {(dateFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={resetLocalFilters}
              className="min-h-[38px] inline-flex items-center justify-center space-x-1 px-3 py-2 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer whitespace-nowrap shrink-0 sm:col-span-2 lg:col-span-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Work Entries List for this Executive */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            Submitted Work Logs ({filteredEntries.length})
          </h2>
          <span className="text-xs text-stone-500">
            Tap any work log to open full details & photos
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-stone-200 space-y-3">
            <ClipboardList className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="text-base font-bold text-stone-900">
              No matching work logs found for {workerName}
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              {workerEntries.length === 0
                ? `${workerName} has not submitted any field logs yet. Once they submit a log from site, it will appear here immediately.`
                : 'No logs match the current date or status filter. Try resetting your filters.'}
            </p>
            {(dateFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={resetLocalFilters}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 transition-colors cursor-pointer"
              >
                Show All {workerEntries.length} Logs
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const isDone = entry.status === 'Done';
              const photos = entry.photos || [];
              const formattedTime = entry.createdAt?.toDate
                ? entry.createdAt.toDate().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : entry.date || 'Recently';

              return (
                <div
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 hover:border-amber-500 active:scale-[0.995] transition-all cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Left & Center: Title, Metadata, Location, GPS, Remark */}
                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Top Metadata Row */}
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs">
                        <span className="font-mono tabular-nums font-semibold text-stone-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{entry.date || formattedTime}</span>
                        </span>
                        <span aria-hidden="true" className="text-stone-300 hidden xs:inline">·</span>
                        <span className="text-stone-500 font-mono tabular-nums hidden xs:inline">
                          Logged {formattedTime}
                        </span>
                        <span aria-hidden="true" className="text-stone-300">·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isDone ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Done</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                        {photos.length > 0 && (
                          <>
                            <span aria-hidden="true" className="text-stone-300">·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <Camera className="w-3.5 h-3.5 shrink-0" />
                              <span>{photos.length} Photo{photos.length > 1 ? 's' : ''}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Primary Route / Work Title */}
                      <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-snug break-words">
                        {entry.route || entry.workType || 'Site Work Log'}
                      </h3>

                      {/* Structured Info Columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2.5 border-t border-stone-100 text-xs">
                        <div>
                          <span className="text-stone-500 block mb-0.5">Site Location</span>
                          <span className="font-semibold text-stone-900 flex items-start gap-1 break-words">
                            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{entry.location || entry.locationFrom || 'Not specified'}</span>
                          </span>
                        </div>

                        <div>
                          <span className="text-stone-500 block mb-0.5">GPS Coordinates (Lat/Long)</span>
                          <span className="font-mono tabular-nums font-medium text-stone-800 flex items-start gap-1 break-all">
                            <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                            <span>{entry.latLong || 'Not recorded'}</span>
                          </span>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-1">
                          <span className="text-stone-500 block mb-0.5">Remarks / Notes</span>
                          <span className="text-stone-700 line-clamp-2 break-words">
                            {entry.remark || 'No additional remarks'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Photo Thumbnails & Open Action */}
                    <div
                      className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {photos.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                          {photos.slice(0, 3).map((photo, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                onOpenLightbox(
                                  photos,
                                  idx,
                                  `${entry.userName} · ${entry.route || entry.workType}`
                                )
                              }
                              className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-300 hover:border-amber-500 transition-colors cursor-pointer shrink-0"
                            >
                              <img
                                src={photo}
                                alt={`Site photo ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              {idx === 2 && photos.length > 3 && (
                                <div className="absolute inset-0 bg-black/65 text-white text-xs font-bold flex items-center justify-center">
                                  +{photos.length - 3}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto lg:ml-0">
                        <button
                          type="button"
                          onClick={() => onShareEntry(entry)}
                          className="flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectEntry(entry)}
                          className="flex-1 sm:flex-initial min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Open Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
