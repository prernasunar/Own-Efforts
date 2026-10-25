import React, { useState, useMemo } from 'react';
import { useWorkData } from '../context/WorkDataContext';
import { WorkEntry } from '../types';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Share2,
  Search,
  RotateCcw,
  MapPin,
  ClipboardList,
  Camera,
  FileSpreadsheet,
  UserPlus,
  RefreshCw,
  Trash2,
  Presentation,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { formatSingleEntryText, formatTeamReportText } from '../utils/share';
import { ShareModal } from './ShareModal';
import { PhotoLightbox } from './PhotoLightbox';
import { ExcelExportModal } from './ExcelExportModal';
import { PptExportModal } from './PptExportModal';
import { AddWorkerModal } from './AddWorkerModal';
import { EntryDetailPage } from './EntryDetailPage';
import { FieldExecutiveDetailPage } from './FieldExecutiveDetailPage';

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

export const ManagerDashboard: React.FC = () => {
  const { entries, teamWorkers, addWorker, removeWorker, refreshData } = useWorkData();

  // Dedicated Page Navigation States
  const [selectedExecutivePage, setSelectedExecutivePage] = useState<string | null>(null);
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<WorkEntry | null>(null);

  // Filter States for Main Logs Feed
  const [selectedWorker, setSelectedWorker] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL'); // 'ALL', 'TODAY', 'CUSTOM'
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // 'ALL', 'Pending', 'Done'
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals State
  const [shareData, setShareData] = useState<{ title: string; text: string; photos?: string[] } | null>(null);
  const [lightboxData, setLightboxData] = useState<{ photos: string[]; index: number; title: string } | null>(null);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [showPptModal, setShowPptModal] = useState<boolean>(false);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Extract unique field executive names from active teamWorkers
  const uniqueWorkerNames = useMemo(() => {
    const map = new Map<string, string>();
    teamWorkers.forEach((w) => {
      if (w.name && w.name.trim()) {
        const key = w.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, w.name.trim());
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [teamWorkers]);

  const handleRemoveExecutive = async (e: React.MouseEvent | null, workerName: string, uid?: string) => {
    if (e) e.stopPropagation();
    if (selectedWorker.trim().toLowerCase() === workerName.trim().toLowerCase()) {
      setSelectedWorker('ALL');
    }
    if (selectedExecutivePage && selectedExecutivePage.trim().toLowerCase() === workerName.trim().toLowerCase()) {
      setSelectedExecutivePage(null);
    }
    await removeWorker(workerName, uid);
  };

  // Worker Statistics for Manager Cards
  const workerStats = useMemo(() => {
    return uniqueWorkerNames
      .map((workerName) => {
        const cleanName = workerName.trim().toLowerCase();
        const workerEntries = entries.filter(
          (e) => (e.userName || '').trim().toLowerCase() === cleanName
        );
        const totalEntries = workerEntries.length;
        const doneEntries = workerEntries.filter((e) => e.status === 'Done').length;
        const pendingEntries = workerEntries.filter((e) => e.status === 'Pending').length;
        const todayEntries = workerEntries.filter(isEntryToday);

        const registeredProfile = teamWorkers.find(
          (tw) => (tw.name || '').trim().toLowerCase() === cleanName
        );

        const activeToday = todayEntries.length > 0;

        return {
          uid: registeredProfile?.uid,
          name: workerName,
          email: registeredProfile?.email || `${cleanName.replace(/\s+/g, '.')}@site.work`,
          role: registeredProfile?.role || 'Field Executive',
          totalEntries,
          doneEntries,
          pendingEntries,
          activeToday,
          todayCount: todayEntries.length,
        };
      })
      .sort((a, b) => {
        if (a.activeToday && !b.activeToday) return -1;
        if (!a.activeToday && b.activeToday) return 1;
        return b.totalEntries - a.totalEntries;
      });
  }, [uniqueWorkerNames, entries, teamWorkers]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const todayEntries = entries.filter(isEntryToday);
    const totalToday = todayEntries.length;
    const totalAll = entries.length;
    const totalPending = entries.filter((e) => e.status === 'Pending').length;
    const totalDone = entries.filter((e) => e.status === 'Done').length;
    const workersToday = new Set(
      todayEntries.map((e) => (e.userName || '').trim().toLowerCase()).filter(Boolean)
    ).size;

    return { totalAll, totalToday, totalPending, totalDone, workersToday };
  }, [entries]);

  // Filtered entries calculation
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedWorker !== 'ALL') {
        const cleanTarget = selectedWorker.trim().toLowerCase();
        const workerName = (entry.userName || '').trim().toLowerCase();
        const workerUid = entry.uid || '';
        if (workerName !== cleanTarget && workerUid !== selectedWorker) {
          return false;
        }
      }

      if (selectedStatus !== 'ALL' && entry.status !== selectedStatus) {
        return false;
      }

      if (selectedDate === 'TODAY') {
        if (!isEntryToday(entry)) return false;
      } else if (selectedDate === 'CUSTOM' && customDate) {
        if (!isEntryOnDate(entry, customDate)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesType = (entry.workType || '').toLowerCase().includes(q);
        const matchesRoute = (entry.route || '').toLowerCase().includes(q);
        const matchesWorker = (entry.userName || '').toLowerCase().includes(q);
        const matchesLoc =
          (entry.location || '').toLowerCase().includes(q) ||
          (entry.locationFrom || '').toLowerCase().includes(q) ||
          (entry.locationTo || '').toLowerCase().includes(q);
        const matchesRemark = (entry.remark || '').toLowerCase().includes(q);

        if (!matchesType && !matchesRoute && !matchesWorker && !matchesLoc && !matchesRemark) {
          return false;
        }
      }

      return true;
    });
  }, [entries, selectedWorker, selectedStatus, selectedDate, customDate, searchQuery]);

  // Share handlers
  const handleShareAllFiltered = () => {
    const filterDescription = [];
    if (selectedWorker !== 'ALL') filterDescription.push(`Executive: ${selectedWorker}`);
    if (selectedDate === 'TODAY') filterDescription.push('Today');
    else if (selectedDate === 'CUSTOM') filterDescription.push(`Date: ${customDate}`);
    else filterDescription.push('All Dates');
    if (selectedStatus !== 'ALL') filterDescription.push(`Status: ${selectedStatus}`);

    const text = formatTeamReportText(
      filteredEntries,
      filterDescription.length > 0 ? filterDescription.join(', ') : 'All Logs'
    );

    const allFilteredPhotos = filteredEntries.flatMap((e) => e.photos || []);

    setShareData({
      title: 'Share Team Daily Report',
      text,
      photos: allFilteredPhotos,
    });
  };

  const handleShareSingle = (entry: WorkEntry) => {
    const text = formatSingleEntryText(entry);
    setShareData({
      title: `Share Log: ${entry.route || entry.workType} (${entry.userName})`,
      text,
      photos: entry.photos || [],
    });
  };

  const handleShareWorkerSummary = (workerName: string, customList?: WorkEntry[]) => {
    const workerLogs =
      customList ||
      entries.filter(
        (e) => (e.userName || '').trim().toLowerCase() === workerName.trim().toLowerCase()
      );
    const text = formatTeamReportText(workerLogs, `Executive Summary: ${workerName}`);
    const photos = workerLogs.flatMap((e) => e.photos || []);
    setShareData({
      title: `Share Executive Report: ${workerName}`,
      text,
      photos,
    });
  };

  const resetFilters = () => {
    setSelectedWorker('ALL');
    setSelectedDate('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await refreshData();
    } finally {
      setTimeout(() => setSyncing(false), 500);
    }
  };

  // 1. Dedicated Entry Detail Page (Photos on Top + Full Log Details)
  const activeDetailEntry = selectedEntryForDetail
    ? entries.find((e) => e.id === selectedEntryForDetail.id) || selectedEntryForDetail
    : null;

  if (activeDetailEntry) {
    return (
      <>
        <EntryDetailPage
          entry={activeDetailEntry}
          onBack={() => setSelectedEntryForDetail(null)}
          onShare={(entry) => handleShareSingle(entry)}
          onFilterByWorker={(workerName) => {
            setSelectedEntryForDetail(null);
            setSelectedExecutivePage(workerName);
          }}
        />
        {shareData && (
          <ShareModal
            isOpen={Boolean(shareData)}
            onClose={() => setShareData(null)}
            title={shareData.title}
            shareText={shareData.text}
            photos={shareData.photos}
          />
        )}
      </>
    );
  }

  // 2. Dedicated Field Executive Detail Page (when clicking on any Field Executive)
  if (selectedExecutivePage) {
    const activeWorkerObj = workerStats.find(
      (w) => w.name.trim().toLowerCase() === selectedExecutivePage.trim().toLowerCase()
    );

    return (
      <>
        <FieldExecutiveDetailPage
          workerName={activeWorkerObj?.name || selectedExecutivePage}
          workerEmail={activeWorkerObj?.email}
          workerUid={activeWorkerObj?.uid}
          entries={entries}
          onBack={() => setSelectedExecutivePage(null)}
          onSelectEntry={(entry) => setSelectedEntryForDetail(entry)}
          onShareSummary={(name, list) => handleShareWorkerSummary(name, list)}
          onShareEntry={(entry) => handleShareSingle(entry)}
          onOpenLightbox={(photos, index, title) => setLightboxData({ photos, index, title })}
          onRemoveExecutive={(name, uid) => handleRemoveExecutive(null, name, uid)}
        />
        {shareData && (
          <ShareModal
            isOpen={Boolean(shareData)}
            onClose={() => setShareData(null)}
            title={shareData.title}
            shareText={shareData.text}
            photos={shareData.photos}
          />
        )}
        {lightboxData && (
          <PhotoLightbox
            isOpen={Boolean(lightboxData)}
            photos={lightboxData.photos}
            initialIndex={lightboxData.index}
            title={lightboxData.title}
            onClose={() => setLightboxData(null)}
          />
        )}
      </>
    );
  }

  // 3. Clean, Responsive Manager Dashboard for Mobile, Tablet & Desktop
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 font-sans">
      {/* SECTION 1: CLEAN HEADER & KPI OVERVIEW */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-stone-500 flex-wrap">
              <span>Manager Operations</span>
              <span aria-hidden="true">·</span>
              <span>{uniqueWorkerNames.length} Field Executives</span>
              <span aria-hidden="true">·</span>
              <span>{summaryMetrics.workersToday} Active Today</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 mt-1">
              Site Operations & Field Logs
            </h2>
          </div>

          {/* Responsive Action Toolbar: 2-column touch grid on mobile, inline row on tablet/desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setShowAddWorkerModal(true)}
              className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Executive</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPptModal(true)}
              className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Presentation className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Export to PPT</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareAllFiltered}
                className="flex-1 sm:flex-initial min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="min-h-[42px] min-w-[42px] p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Refresh logs"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-amber-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 4 Scannable KPI Summary Boxes (2x2 on Mobile, 4-col on Tablet/Desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={() => {
              setSelectedDate('ALL');
              setSelectedStatus('ALL');
            }}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              selectedDate === 'ALL' && selectedStatus === 'ALL'
                ? 'bg-stone-100 border-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-stone-500 block">Total Site Logs</span>
            <span className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tabular-nums mt-1 block">
              {summaryMetrics.totalAll}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5 block truncate">All submitted records</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedDate(selectedDate === 'TODAY' ? 'ALL' : 'TODAY');
            }}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              selectedDate === 'TODAY'
                ? 'bg-amber-50 border-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-stone-500 block">Logged Today</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1 block">
              {summaryMetrics.totalToday}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5 block truncate">
              {summaryMetrics.workersToday} active today
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Done' ? 'ALL' : 'Done')}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              selectedStatus === 'Done'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-emerald-700 block">Completed (Done)</span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1 block">
              {summaryMetrics.totalDone}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5 block truncate">Verified site tasks</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Pending' ? 'ALL' : 'Pending')}
            className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              selectedStatus === 'Pending'
                ? 'bg-amber-50 border-amber-500'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span className="text-xs font-medium text-amber-700 block">Pending Tasks</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1 block">
              {summaryMetrics.totalPending}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5 block truncate">Work in progress</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: SITE FIELD EXECUTIVES (CLICK TO OPEN DEDICATED EXECUTIVE PAGE) */}
      <section className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Site Field Executives ({workerStats.length})</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Tap any Field Executive to open their dedicated page with all logs, photos, and reports
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
          {workerStats.map((w) => {
            const initials = w.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase();

            return (
              <div
                key={w.name}
                onClick={() => setSelectedExecutivePage(w.name)}
                className="p-4 rounded-xl bg-stone-50 hover:bg-white border border-stone-200 hover:border-amber-500 active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-stone-900 text-sm sm:text-base truncate group-hover:text-amber-700 transition-colors">
                        {w.name}
                      </h4>
                      <p className="text-xs text-stone-500 truncate">{w.email}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleRemoveExecutive(e, w.name, w.uid)}
                    className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title={`Remove ${w.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-200/80 text-xs gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 font-mono tabular-nums">
                    <div>
                      <span className="text-stone-500 block font-sans text-[11px]">Total</span>
                      <span className="font-bold text-stone-900 text-sm">{w.totalEntries}</span>
                    </div>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <div>
                      <span className="text-stone-500 block font-sans text-[11px]">Today</span>
                      <span className={`font-bold text-sm ${w.todayCount > 0 ? 'text-emerald-700' : 'text-stone-600'}`}>
                        {w.todayCount}
                      </span>
                    </div>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <div>
                      <span className="text-stone-500 block font-sans text-[11px]">Done / Pend</span>
                      <span className="font-bold text-stone-900 text-sm">
                        {w.doneEntries} / {w.pendingEntries}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
                    <span>Open Page</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: RESPONSIVE FILTER BAR FOR ALL LOGS */}
      <section className="bg-white rounded-2xl p-4 border border-stone-200 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search route, location, GPS coordinates, executive, or remarks..."
              className="w-full min-h-[42px] pl-9 pr-4 py-2 text-sm rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Filter Controls: Stack cleanly on mobile, inline on tablet/desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-stretch sm:items-center gap-2">
            {/* Executive Select */}
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full lg:w-auto min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 text-stone-900 text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">All Executives ({uniqueWorkerNames.length})</option>
              {uniqueWorkerNames.map((name) => {
                const count = entries.filter(
                  (e) => (e.userName || '').trim().toLowerCase() === name.trim().toLowerCase()
                ).length;
                return (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                );
              })}
            </select>

            {/* Date Select */}
            <div className="flex items-center gap-1.5 w-full lg:w-auto">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 lg:flex-initial min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 text-stone-900 text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="ALL">All Dates ({entries.length})</option>
                <option value="TODAY">Today Only ({summaryMetrics.totalToday})</option>
                <option value="CUSTOM">Specific Date</option>
              </select>
              {selectedDate === 'CUSTOM' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="min-h-[42px] px-2.5 py-1.5 text-xs rounded-xl border border-stone-300 text-stone-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              )}
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200 sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={() => setSelectedStatus('ALL')}
                className={`flex-1 lg:flex-initial min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedStatus === 'ALL'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('Pending')}
                className={`flex-1 lg:flex-initial min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedStatus === 'Pending'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('Done')}
                className={`flex-1 lg:flex-initial min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedStatus === 'Done'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Done
              </button>
            </div>

            {(selectedWorker !== 'ALL' || selectedDate !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[38px] inline-flex items-center justify-center space-x-1 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer whitespace-nowrap shrink-0 sm:col-span-2 lg:col-span-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 4: READABLE FIELD LOGS FEED */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              All Field Work Logs ({filteredEntries.length})
            </h3>
            <p className="text-xs text-stone-500">
              Tap any log to view full-page photos and details, or tap an executive's name to open their page
            </p>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-stone-200 space-y-3">
            <ClipboardList className="w-10 h-10 text-stone-400 mx-auto" />
            <h4 className="font-bold text-stone-900 text-base">
              No matching site work logs found
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              {selectedWorker !== 'ALL' || selectedDate !== 'ALL' || selectedStatus !== 'ALL' || searchQuery
                ? 'No logs match your current filters. Tap below to reset all filters.'
                : 'When field executives submit their daily site work logs, they will appear here automatically.'}
            </p>
            {(selectedWorker !== 'ALL' || selectedDate !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const formattedDate = entry.createdAt?.toDate
                ? entry.createdAt.toDate().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : entry.date || 'Just now';

              const isDone = entry.status === 'Done';
              const photos = entry.photos || [];

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntryForDetail(entry)}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 hover:border-amber-500 active:scale-[0.995] transition-all cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Left & Center Content */}
                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Top Metadata Row: Executive Name + Date + Status + Photo Count */}
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExecutivePage(entry.userName);
                          }}
                          className="font-bold text-stone-900 hover:text-amber-700 underline decoration-amber-500/60 underline-offset-2 cursor-pointer py-0.5"
                          title={`Open ${entry.userName}'s dedicated page`}
                        >
                          {entry.userName}
                        </button>
                        <span aria-hidden="true" className="text-stone-300">·</span>
                        <span className="font-mono tabular-nums text-stone-600 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{entry.date || formattedDate}</span>
                        </span>
                        <span aria-hidden="true" className="text-stone-300 hidden xs:inline">·</span>
                        <span className="font-mono tabular-nums text-stone-500 hidden xs:inline">
                          Logged {formattedDate}
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

                      {/* Route / Work Heading */}
                      <h4 className="text-base sm:text-lg font-bold text-stone-900 leading-snug break-words">
                        {entry.route || entry.workType || 'Site Work Log'}
                      </h4>

                      {/* Clean 3-Column Details Row */}
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
                          <span className="text-stone-500 block mb-0.5">Remarks</span>
                          <span className="text-stone-700 line-clamp-2 break-words">
                            {entry.remark || 'No additional remarks'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Photo Preview Strip & Touch-Friendly Action Buttons */}
                    <div
                      className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {photos.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                          {photos.slice(0, 3).map((photo, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() =>
                                setLightboxData({
                                  photos,
                                  index: pIdx,
                                  title: `${entry.userName} · ${entry.route || entry.workType}`,
                                })
                              }
                              className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-300 hover:border-amber-500 transition-colors cursor-pointer shrink-0"
                            >
                              <img
                                src={photo}
                                alt={`Site Photo ${pIdx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              {pIdx === 2 && photos.length > 3 && (
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
                          onClick={() => handleShareSingle(entry)}
                          className="flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Share
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedEntryForDetail(entry)}
                          className="flex-1 sm:flex-initial min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>View Details</span>
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

      {/* Date-Wise & User-Wise PowerPoint (.pptx) Export Modal */}
      <PptExportModal
        isOpen={showPptModal}
        onClose={() => setShowPptModal(false)}
        entries={entries}
        workerNames={uniqueWorkerNames}
        initialWorker={selectedWorker}
        initialDateType={selectedDate === 'CUSTOM' ? 'CUSTOM_DATE' : selectedDate === 'TODAY' ? 'TODAY' : 'ALL'}
        initialCustomDate={customDate}
      />

      {/* Add Field Worker Modal */}
      <AddWorkerModal
        isOpen={showAddWorkerModal}
        onClose={() => setShowAddWorkerModal(false)}
        onAdd={async (worker) => {
          await addWorker(worker);
        }}
      />
    </div>
  );
};
