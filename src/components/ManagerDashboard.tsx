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
  const { entries, teamWorkers, loading } = useWorkData();

  // Active view tab: 'logs' or 'workers'
  const [activeTab, setActiveTab] = useState<'logs' | 'workers'>('logs');

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

  // Extract unique worker names combining registered team members & submitted entries
  const uniqueWorkerNames = useMemo(() => {
    const names = new Set<string>();
    teamWorkers.forEach((w) => {
      if (w.name) names.add(w.name);
    });
    entries.forEach((e) => {
      if (e.userName) names.add(e.userName);
    });
    return Array.from(names).sort();
  }, [teamWorkers, entries]);

  // Comprehensive Worker Statistics for Manager Roster
  const workerStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    return uniqueWorkerNames.map((workerName) => {
      const workerEntries = entries.filter((e) => e.userName.toLowerCase() === workerName.toLowerCase());
      const totalEntries = workerEntries.length;
      const doneEntries = workerEntries.filter((e) => e.status === 'Done').length;
      const pendingEntries = workerEntries.filter((e) => e.status === 'Pending').length;

      // Total meters & total numbers
      const totalMeters = workerEntries
        .filter((e) => e.uom === 'meter')
        .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      const totalNos = workerEntries
        .filter((e) => e.uom === 'Number')
        .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);

      const todayEntries = workerEntries.filter((e) => {
        if (!e.createdAt?.toDate) return false;
        return e.createdAt.toDate().toDateString() === todayStr;
      });

      const registeredProfile = teamWorkers.find(
        (tw) => tw.name.toLowerCase() === workerName.toLowerCase()
      );

      const activeToday = todayEntries.length > 0;
      const latestEntry = workerEntries[0];

      return {
        name: workerName,
        email: registeredProfile?.email || `${workerName.toLowerCase().replace(/\s+/g, '.')}@site.work`,
        role: registeredProfile?.role || 'Field Worker',
        totalEntries,
        doneEntries,
        pendingEntries,
        totalMeters,
        totalNos,
        activeToday,
        todayCount: todayEntries.length,
        latestEntryDate: latestEntry?.createdAt?.toDate ? latestEntry.createdAt.toDate() : null,
      };
    }).sort((a, b) => {
      if (a.activeToday && !b.activeToday) return -1;
      if (!a.activeToday && b.activeToday) return 1;
      return b.totalEntries - a.totalEntries;
    });
  }, [uniqueWorkerNames, entries, teamWorkers]);

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

  const handleShareWorkerSummary = (workerName: string) => {
    const workerLogs = entries.filter((e) => e.userName.toLowerCase() === workerName.toLowerCase());
    const text = formatTeamReportText(workerLogs, `Worker Summary: ${workerName}`);
    const photos = workerLogs.flatMap((e) => e.photos || []);
    setShareData({
      title: `Share Worker Summary: ${workerName}`,
      text,
      photos,
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

  const selectWorkerAndFilterLogs = (workerName: string) => {
    setSelectedWorker(workerName);
    setActiveTab('logs');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 font-sans">
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

      {/* VIEW SWITCHER: All Field Logs Feed vs Field Workers Directory */}
      <div className="flex items-center space-x-2 bg-stone-200/90 p-1.5 rounded-2xl border border-stone-300 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center space-x-2 transition-all ${
            activeTab === 'logs'
              ? 'bg-stone-900 text-white shadow-md'
              : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100/70'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>All Field Logs Feed ({entries.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workers')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center space-x-2 transition-all ${
            activeTab === 'workers'
              ? 'bg-stone-900 text-white shadow-md'
              : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100/70'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Field Workers Directory ({workerStats.length})</span>
        </button>
      </div>

      {/* TAB 1: ALL FIELD LOGS FEED */}
      {activeTab === 'logs' && (
        <>
          {/* Active Worker Filter Banner if filtered */}
          {selectedWorker !== 'ALL' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-amber-950">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl">👷</span>
                <div>
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                    Filtered by Worker:
                  </span>
                  <p className="font-extrabold text-sm sm:text-base text-amber-950">
                    {selectedWorker}{' '}
                    <span className="text-xs font-normal text-amber-800">
                      ({filteredEntries.length} matching logs)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleShareWorkerSummary(selectedWorker)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
                >
                  Share Worker Summary
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWorker('ALL')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-amber-100 text-stone-800 border border-amber-300 transition-colors"
                >
                  View All Workers
                </button>
              </div>
            </div>
          )}

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
                  Filter by Worker ({uniqueWorkerNames.length} Total)
                </label>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="ALL">👥 All Field Workers ({uniqueWorkerNames.length})</option>
                  {uniqueWorkerNames.map((name) => {
                    const count = entries.filter((e) => e.userName.toLowerCase() === name.toLowerCase()).length;
                    return (
                      <option key={name} value={name}>
                        👷 {name} ({count} logs)
                      </option>
                    );
                  })}
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

              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                {/* Quick Export Current View */}
                <button
                  type="button"
                  onClick={handleQuickExportCurrentView}
                  disabled={quickExporting || filteredEntries.length === 0}
                  className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
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
                  Live updates from all site workers (Manager view - Read Only)
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
                              <button
                                type="button"
                                onClick={() => selectWorkerAndFilterLogs(entry.userName)}
                                className="font-extrabold text-sm sm:text-base text-stone-900 hover:text-amber-800 transition-colors text-left"
                                title="Filter logs to this worker"
                              >
                                {entry.userName}
                              </button>
                              <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-semibold border border-stone-200">
                                Field Worker
                              </span>
                            </div>
                            <h4 className="text-base sm:text-lg font-black text-amber-900 mt-0.5">
                              {entry.route || entry.workType || 'Site Work Log'}
                            </h4>
                            <div className="flex items-center space-x-2 text-xs text-stone-500 mt-0.5 flex-wrap">
                              {entry.date && (
                                <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  📅 Date: {entry.date}
                                </span>
                              )}
                              <span>Logged: {formattedDate}</span>
                            </div>
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

                          {/* Photo badge or quantity */}
                          {entry.photos && entry.photos.length > 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 text-right flex items-center space-x-1 text-amber-800">
                              <Camera className="w-3 h-3" />
                              <span className="text-xs font-black">{entry.photos.length} photo{entry.photos.length > 1 ? 's' : ''}</span>
                            </div>
                          ) : entry.quantity && entry.quantity > 1 ? (
                            <div className="bg-stone-100 border border-stone-300 rounded-lg px-2.5 py-0.5 text-right">
                              <span className="font-black text-xs text-stone-900">
                                {entry.quantity} {entry.uom}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Route, Location, Lat & Log, Remarks */}
                      <div className="bg-stone-50 rounded-xl p-3 text-xs space-y-2 border border-stone-200/80 mb-3">
                        {entry.date && (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-stone-600 flex-shrink-0">📅 Work Date:</span>
                            <span className="font-extrabold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                              {entry.date}
                            </span>
                          </div>
                        )}

                        {entry.route && (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-stone-600 flex-shrink-0">🛣️ Route:</span>
                            <span className="font-extrabold text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                              {entry.route}
                            </span>
                          </div>
                        )}

                        {(entry.location || entry.locationFrom) ? (
                          <div className="flex items-start space-x-2">
                            <span className="font-bold text-stone-600 flex-shrink-0">📍 Location:</span>
                            <span className="text-stone-900 font-medium break-words">
                              {entry.location || entry.locationFrom}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-stone-400 italic text-[11px]">
                            <span>📍 Location: Not specified</span>
                          </div>
                        )}

                        {entry.latLong && (
                          <div className="flex items-start space-x-2">
                            <span className="font-bold text-stone-600 flex-shrink-0">🌐 Lat & Log:</span>
                            <span className="text-stone-900 font-bold font-mono bg-white px-2 py-0.5 rounded border border-stone-200 break-words">
                              {entry.latLong}
                            </span>
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

                      {/* Share Individual Log */}
                      <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                        <span className="text-[11px] text-stone-400 font-medium italic">
                          Verified site log • UID: {entry.uid.substring(0, 8)}...
                        </span>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => selectWorkerAndFilterLogs(entry.userName)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors"
                          >
                            <UserIcon className="w-3 h-3 text-stone-500" />
                            <span>Worker Logs</span>
                          </button>

                          <button
                            onClick={() => handleShareSingle(entry)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-xs"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB 2: FIELD WORKERS DIRECTORY & PERFORMANCE ROSTER */}
      {activeTab === 'workers' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight flex items-center space-x-2">
                <Users className="w-5 h-5 text-amber-600" />
                <span>Field Workers Roster ({workerStats.length} Workers)</span>
              </h3>
              <p className="text-xs font-medium text-stone-500">
                Complete overview of all field personnel and individual work metrics
              </p>
            </div>

            <button
              onClick={() => setShowExcelModal(true)}
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Export Team Excel</span>
            </button>
          </div>

          {/* Workers Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workerStats.map((w) => {
              const donePercent =
                w.totalEntries > 0 ? Math.round((w.doneEntries / w.totalEntries) * 100) : 0;

              return (
                <div
                  key={w.name}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Worker Header: Name, Avatar, Active Badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-950 font-black text-base flex items-center justify-center flex-shrink-0 shadow-2xs">
                          {w.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-base font-extrabold text-stone-900">{w.name}</h4>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-semibold border border-stone-200">
                              {w.role}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 truncate max-w-[200px]">{w.email}</p>
                        </div>
                      </div>

                      {/* Active Status Badge */}
                      {w.activeToday ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span>Active Today ({w.todayCount})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-500 border border-stone-200">
                          No logs today
                        </span>
                      )}
                    </div>

                    {/* Stats Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-stone-50 rounded-xl border border-stone-200/80 mb-3 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">
                          Total Logs
                        </span>
                        <span className="text-lg font-black text-stone-900">{w.totalEntries}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">
                          Meters (m)
                        </span>
                        <span className="text-lg font-black text-amber-700">
                          {w.totalMeters.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">
                          Units (Nos)
                        </span>
                        <span className="text-lg font-black text-stone-800">
                          {w.totalNos.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar (Done vs Pending) */}
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-stone-600">Completion Status</span>
                        <span className="text-stone-900 font-bold">
                          {w.doneEntries} Done / {w.pendingEntries} Pending ({donePercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${donePercent}%` }}
                        />
                        <div
                          className="bg-orange-400 h-full transition-all"
                          style={{ width: `${100 - donePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Worker Action Buttons */}
                  <div className="flex items-center space-x-2 pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => selectWorkerAndFilterLogs(w.name)}
                      className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 transition-colors shadow-xs"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>View Logs ({w.totalEntries})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareWorkerSummary(w.name)}
                      className="inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors"
                      title="Share this worker's report to WhatsApp or clipboard"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
