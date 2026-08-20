import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkData } from '../context/WorkDataContext';
import { WorkEntry, EntryStatus } from '../types';
import {
  Users,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  Share2,
  MessageSquare,
  Search,
  RotateCcw,
  User as UserIcon,
  Layers,
  MapPin,
  ClipboardList,
  Sparkles,
  Camera,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { formatSingleEntryText, formatTeamReportText } from '../utils/share';
import { ShareModal } from './ShareModal';
import { PhotoLightbox } from './PhotoLightbox';
import { ExcelExportModal } from './ExcelExportModal';
import { exportCivilWorkToExcel } from '../utils/excelExporter';

export const ManagerDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const { entries, loading } = useWorkData();

  // Filter States
  const [selectedWorker, setSelectedWorker] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('TODAY'); // 'TODAY', 'ALL', 'CUSTOM'
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // 'ALL', 'Pending', 'Done'
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Share, Excel & Lightbox Modal State
  const [shareData, setShareData] = useState<{ title: string; text: string; photos?: string[] } | null>(null);
  const [lightboxData, setLightboxData] = useState<{ photos: string[]; index: number; title: string } | null>(null);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [quickExporting, setQuickExporting] = useState<boolean>(false);

  // Extract unique worker names for dropdown
  const uniqueWorkerNames = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((e) => {
      if (e.userName) names.add(e.userName);
    });
    return Array.from(names).sort();
  }, [entries]);

  // Today's summary metrics
  const todayMetrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayEntries = entries.filter((e) => {
      if (!e.createdAt?.toDate) return false;
      return e.createdAt.toDate().toDateString() === todayStr;
    });

    const totalToday = todayEntries.length;
    const pendingToday = todayEntries.filter((e) => e.status === 'Pending').length;
    const doneToday = todayEntries.filter((e) => e.status === 'Done').length;

    // Active workers today
    const workersToday = new Set(todayEntries.map((e) => e.userName)).size;

    return { totalToday, pendingToday, doneToday, workersToday };
  }, [entries]);

  // Filtered entries calculation
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Worker filter
      if (selectedWorker !== 'ALL' && entry.userName !== selectedWorker) {
        return false;
      }

      // 2. Status filter
      if (selectedStatus !== 'ALL' && entry.status !== selectedStatus) {
        return false;
      }

      // 3. Date filter
      if (entry.createdAt?.toDate) {
        const entryDate = entry.createdAt.toDate();
        if (selectedDate === 'TODAY') {
          if (entryDate.toDateString() !== new Date().toDateString()) {
            return false;
          }
        } else if (selectedDate === 'CUSTOM' && customDate) {
          const custom = new Date(customDate);
          if (
            entryDate.getFullYear() !== custom.getFullYear() ||
            entryDate.getMonth() !== custom.getMonth() ||
            entryDate.getDate() !== custom.getDate()
          ) {
            return false;
          }
        }
      }

      // 4. Search query (workType, remark, location, workerName)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesType = entry.workType.toLowerCase().includes(q);
        const matchesWorker = entry.userName.toLowerCase().includes(q);
        const matchesLoc =
          entry.locationFrom.toLowerCase().includes(q) || entry.locationTo.toLowerCase().includes(q);
        const matchesRemark = (entry.remark || '').toLowerCase().includes(q);
        if (!matchesType && !matchesWorker && !matchesLoc && !matchesRemark) {
          return false;
        }
      }

      return true;
    });
  }, [entries, selectedWorker, selectedStatus, selectedDate, customDate, searchQuery]);

  // Handle Share All Filtered
  const handleShareAllFiltered = () => {
    let filterDescription = [];
    if (selectedWorker !== 'ALL') filterDescription.push(`Worker: ${selectedWorker}`);
    if (selectedDate === 'TODAY') filterDescription.push('Today');
    else if (selectedDate === 'CUSTOM') filterDescription.push(`Date: ${customDate}`);
    else filterDescription.push('All Dates');
    if (selectedStatus !== 'ALL') filterDescription.push(`Status: ${selectedStatus}`);

    const text = formatTeamReportText(
      filteredEntries,
      filterDescription.length > 0 ? filterDescription.join(', ') : 'All Logs'
    );

    // Collect all photos from filtered entries
    const allFilteredPhotos = filteredEntries.flatMap((e) => e.photos || []);

    setShareData({
      title: 'Share Filtered Team Daily Report',
      text,
      photos: allFilteredPhotos,
    });
  };

  const handleShareSingle = (entry: WorkEntry) => {
    const text = formatSingleEntryText(entry);
    setShareData({
      title: `Share Log: ${entry.workType} (${entry.userName})`,
      text,
      photos: entry.photos || [],
    });
  };

  const handleQuickExportCurrentView = () => {
    setQuickExporting(true);
    try {
      exportCivilWorkToExcel(entries, {
        workerFilter: selectedWorker,
        dateFilterType: selectedDate === 'TODAY' ? 'TODAY' : selectedDate === 'CUSTOM' ? 'CUSTOM_DATE' : 'ALL',
        customDate: selectedDate === 'CUSTOM' ? customDate : undefined,
        statusFilter: selectedStatus as any,
        groupBy: 'multi_tab_master',
      });
    } catch (err) {
      console.error('Error in quick export:', err);
    } finally {
      setQuickExporting(false);
    }
  };

  const resetFilters = () => {
    setSelectedWorker('ALL');
    setSelectedDate('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 font-sans">
      {/* Manager Header & Overview */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 rounded-2xl p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 text-[11px] font-black uppercase tracking-wider mb-1.5 border border-amber-400/30">
              👔 Field Manager Overview
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Team Operations Dashboard
            </h2>
            <p className="text-xs text-stone-300 mt-0.5">
              Live monitoring of all field worker submissions with date-wise & user-wise Excel export
            </p>
          </div>

          {/* Header Action Buttons (Excel Export & Share All) */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {/* Advanced Excel Export Button */}
            <button
              onClick={() => setShowExcelModal(true)}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-black text-sm shadow-md transition-all border border-emerald-400/40"
              title="Customized Excel export with Date-Wise and User-Wise filters and multi-sheet summaries"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Export to Excel</span>
            </button>

            {/* Share All Button */}
            <button
              onClick={handleShareAllFiltered}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black text-sm shadow-md transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Share (Filtered)</span>
            </button>
          </div>
        </div>

        {/* TOP SUMMARY BAR (Total Entries Today, Pending vs Done, Active Workers) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-stone-700/80">
          {/* Total Today */}
          <div className="bg-stone-800/80 p-3.5 rounded-xl border border-stone-700 flex flex-col">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">
              Total Today
            </span>
            <span className="text-2xl font-black text-white mt-1">
              {todayMetrics.totalToday}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5">Civil work logs</span>
          </div>

          {/* Pending Today */}
          <div className="bg-orange-950/40 p-3.5 rounded-xl border border-orange-800/50 flex flex-col">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wide flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending</span>
            </span>
            <span className="text-2xl font-black text-orange-300 mt-1">
              {todayMetrics.pendingToday}
            </span>
            <span className="text-[10px] text-orange-400/80 mt-0.5">Requires completion</span>
          </div>

          {/* Done Today */}
          <div className="bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-800/50 flex flex-col">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done</span>
            </span>
            <span className="text-2xl font-black text-emerald-300 mt-1">
              {todayMetrics.doneToday}
            </span>
            <span className="text-[10px] text-emerald-400/80 mt-0.5">Verified complete</span>
          </div>

          {/* Active Workers */}
          <div className="bg-stone-800/80 p-3.5 rounded-xl border border-stone-700 flex flex-col">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wide flex items-center space-x-1">
              <Users className="w-3.5 h-3.5" />
              <span>Workers</span>
            </span>
            <span className="text-2xl font-black text-amber-400 mt-1">
              {todayMetrics.workersToday}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5">Active on sites today</span>
          </div>
        </div>
      </div>

      {/* FILTERS BAR: Worker, Date, Status, Search */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center space-x-2 text-stone-900 font-bold text-sm">
            <Filter className="w-4 h-4 text-amber-600" />
            <span>Filter Team Submissions</span>
          </div>

          {(selectedWorker !== 'ALL' || selectedDate !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter by Worker */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Filter by Worker
            </label>
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">👥 All Field Workers ({uniqueWorkerNames.length})</option>
              {uniqueWorkerNames.map((name) => (
                <option key={name} value={name}>
                  👷 {name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Date */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Filter by Date
            </label>
            <div className="flex space-x-1.5">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="ALL">📅 All Dates</option>
                <option value="TODAY">🌟 Today Only</option>
                <option value="CUSTOM">🗓️ Specific Date</option>
              </select>
              {selectedDate === 'CUSTOM' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-2 py-2 text-xs rounded-xl border border-stone-300 text-stone-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Filter by Status */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Filter by Status
            </label>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setSelectedStatus('ALL')}
                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                  selectedStatus === 'ALL'
                    ? 'bg-stone-800 text-white border-stone-800 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('Pending')}
                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                  selectedStatus === 'Pending'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                    : 'bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-100'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('Done')}
                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                  selectedStatus === 'Done'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {/* Search Input & Quick Export Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search work types, locations, remarks, or worker names..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Quick Export Current View */}
            <button
              type="button"
              onClick={handleQuickExportCurrentView}
              disabled={quickExporting || filteredEntries.length === 0}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                filteredEntries.length === 0
                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200'
              }`}
              title="Quickly download current filtered logs as Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>{quickExporting ? 'Exporting...' : `Export Excel (${filteredEntries.length})`}</span>
            </button>

            {/* Advanced Excel Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 transition-colors shadow-xs"
              title="Open full Date-Wise & User-Wise Excel Export Configurator"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Custom Export</span>
            </button>
          </div>
        </div>
      </section>

      {/* REAL-TIME ENTRIES LIST (ALL WORKERS) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              All Field Entries ({filteredEntries.length})
            </h3>
            <p className="text-xs font-medium text-stone-500">
              Live updates from field team (Manager view - Read Only)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowExcelModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Date & User Excel</span>
            </button>

            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Stream</span>
            </span>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-stone-200">
            <ClipboardList className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <p className="font-bold text-stone-700 text-base">No matching work entries found</p>
            <p className="text-xs text-stone-500 mt-1">
              Try adjusting your worker, date, or status filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredEntries.map((entry) => {
              const formattedDate = entry.createdAt?.toDate
                ? entry.createdAt.toDate().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Just now';

              const isDone = entry.status === 'Done';

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-200 hover:border-amber-400 transition-all"
                >
                  {/* Top Bar: Worker Name Highlight + Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-black text-sm flex items-center justify-center flex-shrink-0">
                        {entry.userName
                          ? entry.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()
                          : 'FW'}
                      </div>

                      <div>
                        {/* Clear Worker Name */}
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-extrabold text-sm sm:text-base text-stone-900">
                            {entry.userName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-semibold border border-stone-200">
                            Field Worker
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-amber-900 mt-0.5">
                          {entry.workType}
                        </h4>
                        <span className="text-xs text-stone-500 block">Logged: {formattedDate}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                      {/* Status Badge: Orange = Pending, Green = Done */}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-orange-100 text-orange-800 border-orange-300'
                        }`}
                      >
                        {isDone ? '✅ Done' : '⏳ Pending'}
                      </span>

                      {/* Quantity display */}
                      <div className="bg-stone-100 border border-stone-300 rounded-lg px-2.5 py-1 text-right">
                        <span className="font-black text-sm sm:text-base text-stone-900">
                          {entry.quantity}
                        </span>{' '}
                        <span className="text-[11px] font-bold text-stone-600 uppercase">
                          {entry.uom}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Locations From -> To */}
                  <div className="bg-stone-50 rounded-xl p-3 text-xs space-y-1.5 border border-stone-200/80 mb-3">
                    {entry.locationFrom ? (
                      <div className="flex items-start space-x-2">
                        <span className="font-bold text-stone-600 flex-shrink-0">📍 From:</span>
                        <span className="text-stone-900 font-medium break-words">
                          {entry.locationFrom}
                        </span>
                      </div>
                    ) : null}
                    {entry.locationTo ? (
                      <div className="flex items-start space-x-2">
                        <span className="font-bold text-stone-600 flex-shrink-0">📍 To:</span>
                        <span className="text-stone-900 font-medium break-words">
                          {entry.locationTo}
                        </span>
                      </div>
                    ) : null}
                    {!entry.locationFrom && !entry.locationTo && (
                      <div className="flex items-center space-x-1.5 text-stone-400 italic text-[11px]">
                        <span>📍 Location: Not specified (logged off-site)</span>
                      </div>
                    )}
                    {entry.remark && (
                      <div className="pt-1 border-t border-stone-200/60 flex items-start space-x-2">
                        <span className="font-bold text-stone-600 flex-shrink-0">📝 Remark:</span>
                        <span className="text-stone-700 italic break-words">{entry.remark}</span>
                      </div>
                    )}

                    {/* Attached Photos */}
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="pt-2 border-t border-stone-200/60">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-stone-700 text-[11px] flex items-center space-x-1">
                            <Camera className="w-3.5 h-3.5 text-amber-600" />
                            <span>Site Photos ({entry.photos.length})</span>
                          </span>
                          <span className="text-[10px] text-stone-400 font-semibold">Tap to inspect</span>
                        </div>
                        <div className="flex items-center space-x-2 overflow-x-auto py-1">
                          {entry.photos.map((photo, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() =>
                                setLightboxData({
                                  photos: entry.photos || [],
                                  index: pIdx,
                                  title: `${entry.userName} • ${entry.workType} (${entry.quantity} ${entry.uom})`,
                                })
                              }
                              className="relative w-14 h-14 rounded-lg overflow-hidden border border-stone-300 flex-shrink-0 hover:scale-105 transition-transform shadow-2xs group"
                            >
                              <img
                                src={photo}
                                alt={`Site Photo ${pIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 rounded font-bold">
                                #{pIdx + 1}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Share Individual Log (Manager cannot edit or delete worker entries) */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                    <span className="text-[11px] text-stone-400 font-medium italic">
                      Verified site log • UID: {entry.uid.substring(0, 8)}...
                    </span>

                    <button
                      onClick={() => handleShareSingle(entry)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Log</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={Boolean(shareData)}
          onClose={() => setShareData(null)}
          title={shareData.title}
          shareText={shareData.text}
          photos={shareData.photos}
        />
      )}

      {/* Photo Lightbox Viewer */}
      {lightboxData && (
        <PhotoLightbox
          isOpen={Boolean(lightboxData)}
          photos={lightboxData.photos}
          initialIndex={lightboxData.index}
          title={lightboxData.title}
          onClose={() => setLightboxData(null)}
        />
      )}

      {/* Date-Wise & User-Wise Excel Export Modal */}
      <ExcelExportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        entries={entries}
        initialWorker={selectedWorker}
        initialDateType={selectedDate === 'CUSTOM' ? 'CUSTOM_DATE' : selectedDate === 'TODAY' ? 'TODAY' : 'ALL'}
        initialCustomDate={customDate}
      />
    </div>
  );
};
