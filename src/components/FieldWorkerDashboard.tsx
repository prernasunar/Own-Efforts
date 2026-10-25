import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkData } from '../context/WorkDataContext';
import { WorkEntry, EntryStatus } from '../types';
import {
  MapPin,
  Clock,
  CheckCircle2,
  Share2,
  Edit2,
  Trash2,
  Send,
  Loader2,
  AlertCircle,
  Check,
  Building2,
  Sparkles,
  CheckSquare,
  Square,
  CheckCheck,
  Layers,
  SendHorizontal,
  Camera,
  Navigation,
  Globe,
  Compass,
  Calendar,
  Search,
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  ChevronRight,
  FileSpreadsheet,
  Presentation,
  RotateCcw,
} from 'lucide-react';
import { captureCurrentLocation } from '../utils/geo';
import { formatSingleEntryText, formatWorkerBatchReportText } from '../utils/share';
import { EditEntryModal } from './EditEntryModal';
import { ShareModal } from './ShareModal';
import { PhotoUploader } from './PhotoUploader';
import { PhotoLightbox } from './PhotoLightbox';
import { EntryDetailPage } from './EntryDetailPage';
import { PhotoGpsData } from '../utils/photoGpsExtractor';
import { exportCivilWorkToExcel } from '../utils/excelExporter';
import { exportCivilWorkToPpt } from '../utils/pptExporter';

type ExecutivePageTab = 'DASHBOARD' | 'ENTRY_LOG' | 'SITE_LOGS';

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

export const FieldWorkerDashboard: React.FC = () => {
  const { userProfile, user } = useAuth();
  const { myEntries, createEntry, updateEntry, deleteEntry, workTypes } = useWorkData();

  // Dedicated 3-Page Navigation State:
  // Left = DASHBOARD | Middle = ENTRY_LOG | Right = SITE_LOGS
  const [activePage, setActivePage] = useState<ExecutivePageTab>('DASHBOARD');

  // Core Worker View Form Fields (Date, Route, Location, Lat & Log, Remark, Photos, Status)
  const getTodayIso = () => new Date().toLocaleDateString('en-CA');
  const [date, setDate] = useState<string>(getTodayIso);
  const [route, setRoute] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [latLong, setLatLong] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<EntryStatus>('Done');

  // Quick Date Selectors for Form
  const setTodayDate = () => setDate(getTodayIso());
  const setYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toLocaleDateString('en-CA'));
  };

  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const [y, m, d] = isoStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  // Filter & Search state for Past Site Logs Page
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Pending' | 'Done'>('ALL');
  const [filterDateType, setFilterDateType] = useState<'ALL' | 'TODAY' | 'CUSTOM'>('ALL');
  const [filterCustomDate, setFilterCustomDate] = useState<string>(getTodayIso);

  // Auto-fill and notification states
  const [gpsAutoFillNotice, setGpsAutoFillNotice] = useState<string | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPpt, setExportingPpt] = useState<boolean>(false);

  // Multi-select batch sharing state
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  // Modals, Lightbox & Detail Page state
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<WorkEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{ title: string; text: string; photos?: string[] } | null>(null);
  const [lightboxData, setLightboxData] = useState<{ photos: string[]; index: number; title: string } | null>(null);

  const executiveName = userProfile?.name || user?.displayName || 'Site Field Executive';

  // Dashboard Metrics
  const dashboardStats = useMemo(() => {
    const total = myEntries.length;
    const todayEntries = myEntries.filter(isEntryToday);
    const today = todayEntries.length;
    const done = myEntries.filter((e) => e.status === 'Done').length;
    const pending = myEntries.filter((e) => e.status === 'Pending').length;
    const totalPhotos = myEntries.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
    return { total, today, done, pending, totalPhotos, todayEntries };
  }, [myEntries]);

  // Live GPS Capture button for the Location field
  const handleCaptureLiveLocation = async () => {
    setFormError(null);
    setGpsLoading(true);

    try {
      const geo = await captureCurrentLocation();
      setLocation(geo.formattedAddress);
      const coordsString = `Lat ${geo.latitude.toFixed(6)}° Long ${geo.longitude.toFixed(6)}°`;
      setLatLong(coordsString);
      setGpsAutoFillNotice(`Live GPS detected & filled: ${coordsString}`);
      setTimeout(() => setGpsAutoFillNotice(null), 6000);
    } catch (err: any) {
      setFormError(err.message || 'Live GPS capture failed. You can type location manually or upload photo.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Automatic callback when GPS is extracted from Uploaded or Clicked Photo
  const handleGpsExtracted = (gpsData: PhotoGpsData, photoIndex: number) => {
    const coordsStr =
      gpsData.formattedCoords || `Lat ${gpsData.latitude.toFixed(6)}° Long ${gpsData.longitude.toFixed(6)}°`;
    const locStr = gpsData.address || gpsData.formattedLocation || gpsData.city || '';

    setLatLong(coordsStr);
    if (locStr) {
      setLocation(locStr);
    }

    setGpsAutoFillNotice(
      `Photo #${photoIndex + 1} GPS Detected: Auto-filled Lat & Long (${coordsStr})${
        locStr ? ` and Location (${locStr})` : ''
      }`
    );

    setTimeout(() => {
      setGpsAutoFillNotice(null);
    }, 7000);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!route.trim() && !location.trim() && !latLong.trim() && photos.length === 0) {
      setFormError('Please enter at least Route, Location, Lat & Long, or take/upload a photo.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      await createEntry({
        date: date || getTodayIso(),
        route: route.trim(),
        location: location.trim(),
        latLong: latLong.trim(),
        locationFrom: location.trim(),
        remark: remark.trim(),
        photos,
        status,
        workType: route.trim() || 'Site Work Log',
        quantity: 1,
        uom: 'meter',
      });

      setFormSuccess(true);
      setRemark('');
      setPhotos([]);
      setTimeout(() => setFormSuccess(false), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit site work log.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareEntry = (entry: WorkEntry) => {
    const text = formatSingleEntryText(entry);
    setShareData({
      title: `Share ${entry.route || 'Site Work'} Log`,
      text,
      photos: entry.photos,
    });
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      await deleteEntry(id);
      setDeletingId(null);
      setSelectedEntryIds((prev) => prev.filter((item) => item !== id));
    } catch (err: any) {
      setFormError(err.message || 'Failed to delete work log.');
    }
  };

  // Selection toggle for batch sending
  const toggleSelectEntry = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEntryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedEntryIds.length === filteredMyEntries.length) {
      setSelectedEntryIds([]);
    } else {
      setSelectedEntryIds(filteredMyEntries.map((e) => e.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedEntryIds([]);
  };

  const handleSendSelectedBatch = () => {
    const selected = myEntries.filter((e) => selectedEntryIds.includes(e.id));
    if (selected.length === 0) return;

    const text = formatWorkerBatchReportText(selected, executiveName);
    const batchPhotos = selected.flatMap((e) => e.photos || []);

    setShareData({
      title: `Share ${selected.length} Selected Work${selected.length > 1 ? 's' : ''}`,
      text,
      photos: batchPhotos,
    });
  };

  const handleShareTodayLogs = () => {
    const list = dashboardStats.todayEntries.length > 0 ? dashboardStats.todayEntries : myEntries;
    if (list.length === 0) return;
    const text = formatWorkerBatchReportText(list, executiveName);
    const batchPhotos = list.flatMap((e) => e.photos || []);
    setShareData({
      title: dashboardStats.todayEntries.length > 0 ? "Share Today's Work Logs" : 'Share All Work Logs',
      text,
      photos: batchPhotos,
    });
  };

  const handleExportMyExcel = () => {
    if (myEntries.length === 0) return;
    setExportingExcel(true);
    try {
      exportCivilWorkToExcel(myEntries, {
        workerFilter: 'ALL',
        dateFilterType:
          filterDateType === 'TODAY'
            ? 'TODAY'
            : filterDateType === 'CUSTOM'
            ? 'CUSTOM_DATE'
            : 'ALL',
        customDate: filterDateType === 'CUSTOM' ? filterCustomDate : undefined,
        statusFilter: filterStatus,
        groupBy: 'multi_tab_master',
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportMyPpt = async () => {
    if (myEntries.length === 0) return;
    setExportingPpt(true);
    try {
      await exportCivilWorkToPpt(myEntries, {
        workerFilter: 'ALL',
        dateFilterType:
          filterDateType === 'TODAY'
            ? 'TODAY'
            : filterDateType === 'CUSTOM'
            ? 'CUSTOM_DATE'
            : 'ALL',
        customDate: filterDateType === 'CUSTOM' ? filterCustomDate : undefined,
        statusFilter: filterStatus,
        includeSummarySlide: true,
      });
    } finally {
      setExportingPpt(false);
    }
  };

  // Filter entries for Past Site Logs Page
  const filteredMyEntries = useMemo(() => {
    return myEntries.filter((entry) => {
      if (filterStatus !== 'ALL' && entry.status !== filterStatus) return false;
      if (filterDateType === 'TODAY' && !isEntryToday(entry)) return false;
      if (filterDateType === 'CUSTOM' && filterCustomDate && entry.date !== filterCustomDate) {
        return false;
      }
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        (entry.route && entry.route.toLowerCase().includes(q)) ||
        (entry.location && entry.location.toLowerCase().includes(q)) ||
        (entry.latLong && entry.latLong.toLowerCase().includes(q)) ||
        (entry.remark && entry.remark.toLowerCase().includes(q)) ||
        (entry.date && entry.date.includes(q))
      );
    });
  }, [myEntries, filterStatus, filterDateType, filterCustomDate, filterQuery]);

  const selectedEntries = myEntries.filter((e) => selectedEntryIds.includes(e.id));
  const selectedPhotosCount = selectedEntries.reduce(
    (sum, e) => sum + (e.photos?.length || 0),
    0
  );

  // Full-Page Entry Detail View (Photos on Top + Complete Info)
  const activeDetailEntry = selectedEntryForDetail
    ? myEntries.find((e) => e.id === selectedEntryForDetail.id) || selectedEntryForDetail
    : null;

  if (activeDetailEntry) {
    return (
      <>
        <EntryDetailPage
          entry={activeDetailEntry}
          onBack={() => setSelectedEntryForDetail(null)}
          onShare={(entry) => handleShareEntry(entry)}
          onEdit={(entry) => setEditingEntry(entry)}
          onDelete={(entry) => setDeletingId(entry.id)}
        />
        {editingEntry && (
          <EditEntryModal
            entry={editingEntry}
            workTypes={workTypes}
            isOpen={Boolean(editingEntry)}
            onClose={() => setEditingEntry(null)}
            onSave={async (id, data) => {
              await updateEntry(id, data);
              setEditingEntry(null);
            }}
          />
        )}
        {shareData && (
          <ShareModal
            isOpen={Boolean(shareData)}
            onClose={() => setShareData(null)}
            title={shareData.title}
            shareText={shareData.text}
            photos={shareData.photos}
          />
        )}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200">
              <h4 className="text-base font-bold text-stone-900 mb-2">Delete Work Entry?</h4>
              <p className="text-xs text-stone-600 mb-4">
                This action cannot be undone. Are you sure you want to permanently remove this entry?
              </p>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteConfirm(deletingId);
                    setSelectedEntryForDetail(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 md:pb-10 space-y-5 font-sans">
      {/* =====================================================================
          DESKTOP & TABLET TOP PAGE NAVIGATION BAR
          Order: Left = Dashboard | Middle = Daily Entry Log | Right = Past Site Logs
      ===================================================================== */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
            {executiveName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span>Field Executive Portal</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-amber-700">{dashboardStats.today} Logged Today</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-stone-900 truncate">
              {executiveName}
            </h2>
          </div>
        </div>

        {/* Desktop / Tablet 3-Page Switcher (Hidden on Mobile because Mobile uses Fixed Bottom Nav) */}
        <nav
          aria-label="Field Executive Pages"
          className="hidden md:grid grid-cols-3 gap-1.5 p-1.5 bg-stone-100 rounded-xl border border-stone-200 min-w-[440px]"
        >
          {/* LEFT: DASHBOARD */}
          <button
            type="button"
            onClick={() => setActivePage('DASHBOARD')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activePage === 'DASHBOARD'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          {/* MIDDLE: DAILY ENTRY LOG */}
          <button
            type="button"
            onClick={() => setActivePage('ENTRY_LOG')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activePage === 'ENTRY_LOG'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Daily Entry Log</span>
          </button>

          {/* RIGHT: PAST SITE LOGS */}
          <button
            type="button"
            onClick={() => setActivePage('SITE_LOGS')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activePage === 'SITE_LOGS'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span>Past Site Logs ({myEntries.length})</span>
          </button>
        </nav>
      </div>

      {/* =====================================================================
          PAGE 1 (LEFT): DASHBOARD PAGE
      ===================================================================== */}
      {activePage === 'DASHBOARD' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => {
                setFilterDateType('ALL');
                setFilterStatus('ALL');
                setActivePage('SITE_LOGS');
              }}
              className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-amber-500 text-left transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium text-stone-500 block">Total Site Logs</span>
              <span className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono tabular-nums mt-1 block">
                {dashboardStats.total}
              </span>
              <span className="text-[11px] text-amber-700 font-semibold mt-1 inline-flex items-center gap-0.5">
                <span>View all logs</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterDateType('TODAY');
                setFilterStatus('ALL');
                setActivePage('SITE_LOGS');
              }}
              className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-amber-500 text-left transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium text-stone-500 block">Logged Today</span>
              <span className="text-2xl sm:text-3xl font-bold text-amber-600 font-mono tabular-nums mt-1 block">
                {dashboardStats.today}
              </span>
              <span className="text-[11px] text-stone-500 mt-1 block truncate">
                {formatDisplayDate(getTodayIso())}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterDateType('ALL');
                setFilterStatus('Done');
                setActivePage('SITE_LOGS');
              }}
              className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-emerald-500 text-left transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium text-emerald-700 block">Completed (Done)</span>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums mt-1 block">
                {dashboardStats.done}
              </span>
              <span className="text-[11px] text-stone-500 mt-1 block truncate">
                Verified site tasks
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterDateType('ALL');
                setFilterStatus('Pending');
                setActivePage('SITE_LOGS');
              }}
              className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-amber-500 text-left transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium text-amber-700 block">Pending Work</span>
              <span className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-1 block">
                {dashboardStats.pending}
              </span>
              <span className="text-[11px] text-stone-500 mt-1 block truncate">
                In-progress tasks
              </span>
            </button>
          </div>

          {/* Primary Call-To-Action & Quick Tools */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  Quick Field Actions
                </h3>
                <p className="text-xs text-stone-500">
                  Start a new daily work entry, share today's progress, or export your site reports
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('ENTRY_LOG')}
                className="min-h-[46px] inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer shrink-0"
              >
                <PlusCircle className="w-5 h-5" />
                <span>+ New Daily Entry Log</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setActivePage('SITE_LOGS')}
                className="min-h-[44px] p-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 flex items-center justify-center space-x-2 text-xs font-bold text-stone-800 transition-colors cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-amber-600 shrink-0" />
                <span>All Past Logs ({myEntries.length})</span>
              </button>

              <button
                type="button"
                onClick={handleShareTodayLogs}
                disabled={myEntries.length === 0}
                className="min-h-[44px] p-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 flex items-center justify-center space-x-2 text-xs font-bold text-stone-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Share WhatsApp Report</span>
              </button>

              <button
                type="button"
                onClick={handleExportMyExcel}
                disabled={myEntries.length === 0 || exportingExcel}
                className="min-h-[44px] p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center space-x-2 text-xs font-bold text-emerald-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{exportingExcel ? 'Exporting...' : 'Download Excel'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportMyPpt}
                disabled={myEntries.length === 0 || exportingPpt}
                className="min-h-[44px] p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center justify-center space-x-2 text-xs font-bold text-amber-950 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Presentation className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{exportingPpt ? 'Generating...' : 'Download PPT'}</span>
              </button>
            </div>
          </div>

          {/* Recent Site Logs Preview on Dashboard */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  Recent Site Work Logs
                </h3>
                <p className="text-xs text-stone-500">
                  Your latest submitted entries · Tap any log to view full details & photos
                </p>
              </div>
              {myEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActivePage('SITE_LOGS')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>View All ({myEntries.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {myEntries.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-stone-50 border border-dashed border-stone-200 space-y-3">
                <Building2 className="w-10 h-10 text-stone-400 mx-auto" />
                <div>
                  <p className="font-bold text-stone-800 text-sm">No work logs submitted yet</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Tap the Daily Entry Log button to submit your first site work entry with GPS photos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('ENTRY_LOG')}
                  className="min-h-[42px] inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create First Entry Log</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myEntries.slice(0, 4).map((entry) => {
                  const isDone = entry.status === 'Done';
                  const entryPhotos = entry.photos || [];
                  const displayTitle = entry.route || entry.workType || 'Site Work Log';

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntryForDetail(entry)}
                      className="p-3.5 sm:p-4 rounded-xl bg-stone-50 hover:bg-white border border-stone-200 hover:border-amber-500 transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-bold text-stone-900 truncate text-sm">
                            {displayTitle}
                          </span>
                          <span
                            className={`font-semibold ${
                              isDone ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {isDone ? '· Done' : '· Pending'}
                          </span>
                          <span className="text-stone-400 font-mono text-[11px]">
                            · {entry.date || 'Today'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-600 truncate">
                          {(entry.location || entry.locationFrom) && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">{entry.location || entry.locationFrom}</span>
                            </span>
                          )}
                          {entryPhotos.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold shrink-0">
                              <Camera className="w-3.5 h-3.5" />
                              <span>{entryPhotos.length}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {entryPhotos[0] && (
                          <img
                            src={entryPhotos[0]}
                            alt="Thumb"
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-lg object-cover border border-stone-300"
                          />
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PAGE 2 (MIDDLE): DAILY ENTRY LOG PAGE (DEDICATED FORM PAGE)
      ===================================================================== */}
      {activePage === 'ENTRY_LOG' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-150">
          <section className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-200 gap-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-bold text-stone-900 tracking-tight">
                    Daily Work Entry Log
                  </h3>
                  <p className="text-xs text-stone-500">
                    Route · Location · Auto Lat & Long · Remark · Live GPS Camera
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePage('SITE_LOGS')}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Past Logs ({myEntries.length})
              </button>
            </div>

            {/* Success Alert with Quick Button to View Past Logs */}
            {formSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-xs sm:text-sm">Site Work Logged Successfully!</p>
                    <p className="text-[11px] text-emerald-700">
                      Synced to cloud and visible on manager & executive logs in real time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('SITE_LOGS')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  View in Past Logs →
                </button>
              </div>
            )}

            {/* Error Alert */}
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-semibold">{formError}</p>
              </div>
            )}

            {/* Automatic GPS Auto-fill Notification */}
            {gpsAutoFillNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold truncate">{gpsAutoFillNotice}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGpsAutoFillNotice(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-xs font-black px-1.5 py-0.5 shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* DATE SECTION */}
              <div className="bg-amber-50/70 p-3.5 sm:p-4 rounded-xl border border-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <label className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Work Date / कार्य दिनांक</span>
                  </label>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={setTodayDate}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors border cursor-pointer ${
                        date === getTodayIso()
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={setYesterdayDate}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors border cursor-pointer ${
                        date !== getTodayIso()
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      Yesterday
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-bold focus:border-amber-600 focus:outline-none"
                  />
                  <div className="flex items-center justify-between sm:justify-start space-x-1.5 text-xs font-semibold text-stone-700 bg-white px-3 py-2.5 rounded-xl border border-amber-200 shrink-0">
                    <span className="text-stone-400">Selected:</span>
                    <span className="text-stone-900 font-bold">{formatDisplayDate(date)}</span>
                  </div>
                </div>
              </div>

              {/* 1. ROUTE FIELD */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-amber-600" />
                    <span>Route / Trench Section</span>
                  </label>
                  <span className="text-[11px] text-stone-400 hidden sm:inline">
                    e.g. Route 4, Trench Sec B
                  </span>
                </div>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="e.g. Route 4 / Nerul-Juinagar Link / Sector 23 Feeder"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-medium placeholder-stone-400 focus:border-amber-600 focus:outline-none"
                />
              </div>

              {/* 2. LOCATION FIELD */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>Site Location</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCaptureLiveLocation}
                    disabled={gpsLoading}
                    className="min-h-[34px] inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-800" />
                    ) : (
                      <Compass className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    <span>Capture Live GPS</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Auto-filled from Photo or Live GPS"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-medium placeholder-stone-400 focus:border-amber-600 focus:outline-none"
                />
              </div>

              {/* 3. LAT & LONG FIELD */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lat & Long (Auto-detected from photo / GPS)</span>
                  </label>
                  {latLong && (
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>GPS Synced</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={latLong}
                  onChange={(e) => setLatLong(e.target.value)}
                  placeholder="e.g. Lat 19.053155° Long 73.016608°"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-xs sm:text-sm font-bold font-mono bg-stone-50 focus:bg-white placeholder-stone-400 focus:border-amber-600 focus:outline-none"
                />
              </div>

              {/* 4. REMARK FIELD */}
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">
                  Remark / Site Notes <span className="text-xs font-normal text-stone-500">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. Concrete cover sealed, caution tape installed, backfilled with gravel..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-medium focus:border-amber-600 focus:outline-none"
                />
              </div>

              {/* 5. UPLOAD & CLICK PHOTO OPTIONS */}
              <div className="pt-1">
                <PhotoUploader
                  photos={photos}
                  onChange={setPhotos}
                  maxPhotos={4}
                  disabled={submitting}
                  onGpsExtracted={handleGpsExtracted}
                  onPreviewPhoto={(idx) =>
                    setLightboxData({
                      photos,
                      index: idx,
                      title: `${route || 'Site Work'} - Photo #${idx + 1}`,
                    })
                  }
                />
              </div>

              {/* 6. STATUS (Pending vs Done) */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Work Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('Pending')}
                    className={`min-h-[48px] py-3 px-3 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      status === 'Pending'
                        ? 'border-amber-500 bg-amber-50 text-amber-950'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Clock
                      className={`w-4 h-4 ${
                        status === 'Pending' ? 'text-amber-600' : 'text-stone-400'
                      }`}
                    />
                    <span>Pending</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('Done')}
                    className={`min-h-[48px] py-3 px-3 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      status === 'Done'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        status === 'Done' ? 'text-emerald-600' : 'text-stone-400'
                      }`}
                    />
                    <span>Done</span>
                  </button>
                </div>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-sm sm:text-base shadow-sm disabled:opacity-50 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting Site Log...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Submit Daily Work Log</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* =====================================================================
          PAGE 3 (RIGHT): PAST SITE LOGS PAGE (DEDICATED HISTORY & BATCH PAGE)
      ===================================================================== */}
      {activePage === 'SITE_LOGS' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header, Filters & Export Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center space-x-2">
                  <span>My Past Site Logs</span>
                  <span className="text-xs font-mono font-bold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-lg border border-stone-200">
                    {filteredMyEntries.length} / {myEntries.length}
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  Tap any log to open full details & photos, or select multiple logs to share via WhatsApp
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {myEntries.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportMyExcel}
                      disabled={exportingExcel}
                      className="min-h-[38px] inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportMyPpt}
                      disabled={exportingPpt}
                      className="min-h-[38px] inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Presentation className="w-3.5 h-3.5 text-amber-400" />
                      <span>PPT</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="min-h-[38px] inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
                    >
                      {selectedEntryIds.length === filteredMyEntries.length &&
                      filteredMyEntries.length > 0 ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                          <span>Deselect All</span>
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-stone-600" />
                          <span>Select All ({filteredMyEntries.length})</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search, Date & Status Filter Bar */}
            {myEntries.length > 0 && (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 pt-3 border-t border-stone-100">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search route, location, GPS coordinates, or remarks..."
                    className="w-full min-h-[40px] pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery('')}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2">
                  {/* Date Filter */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={filterDateType}
                      onChange={(e) => setFilterDateType(e.target.value as any)}
                      className="flex-1 lg:flex-initial min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-900 bg-white focus:outline-none"
                    >
                      <option value="ALL">All Dates ({myEntries.length})</option>
                      <option value="TODAY">Today Only ({dashboardStats.today})</option>
                      <option value="CUSTOM">Specific Date</option>
                    </select>
                    {filterDateType === 'CUSTOM' && (
                      <input
                        type="date"
                        value={filterCustomDate}
                        onChange={(e) => setFilterCustomDate(e.target.value)}
                        className="min-h-[40px] px-2.5 py-1.5 text-xs rounded-xl border border-stone-300 text-stone-900"
                      />
                    )}
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('ALL')}
                      className={`flex-1 lg:flex-initial min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        filterStatus === 'ALL'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('Done')}
                      className={`flex-1 lg:flex-initial min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        filterStatus === 'Done'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('Pending')}
                      className={`flex-1 lg:flex-initial min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        filterStatus === 'Pending'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Pending
                    </button>
                  </div>

                  {(filterDateType !== 'ALL' || filterStatus !== 'ALL' || filterQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDateType('ALL');
                        setFilterStatus('ALL');
                        setFilterQuery('');
                      }}
                      className="min-h-[36px] inline-flex items-center justify-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floating Batch Action Bar */}
          {selectedEntryIds.length > 0 && (
            <div className="sticky top-16 z-30 p-3.5 sm:p-4 rounded-2xl bg-stone-900 text-white shadow-xl border border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <p className="font-bold text-sm text-white truncate">
                      {selectedEntryIds.length} Work{selectedEntryIds.length > 1 ? 's' : ''} Selected
                    </p>
                    {selectedPhotosCount > 0 && (
                      <span className="text-amber-300 text-xs font-semibold flex items-center space-x-1">
                        <Camera className="w-3.5 h-3.5" />
                        <span>{selectedPhotosCount} photos</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-300 hidden sm:block">
                    Ready to send together via WhatsApp or device share
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={handleSendSelectedBatch}
                  className="flex-1 sm:flex-initial min-h-[38px] flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  <SendHorizontal className="w-4 h-4" />
                  <span>Send {selectedEntryIds.length} Works</span>
                </button>
              </div>
            </div>
          )}

          {/* Past Site Logs List */}
          {myEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-stone-200 space-y-3">
              <Building2 className="w-10 h-10 text-stone-400 mx-auto" />
              <p className="font-bold text-stone-800 text-base">No site work logs submitted yet</p>
              <p className="text-xs text-stone-500">
                Open the Daily Entry Log tab to submit your first work log today.
              </p>
              <button
                type="button"
                onClick={() => setActivePage('ENTRY_LOG')}
                className="min-h-[42px] inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Go to Daily Entry Log</span>
              </button>
            </div>
          ) : filteredMyEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-stone-200 space-y-2">
              <p className="font-bold text-stone-700 text-sm">No entries match your search or filter.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterQuery('');
                  setFilterStatus('ALL');
                  setFilterDateType('ALL');
                }}
                className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMyEntries.map((entry) => {
                const formattedDate = entry.createdAt?.toDate
                  ? entry.createdAt.toDate().toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Just now';

                const isDone = entry.status === 'Done';
                const isSelected = selectedEntryIds.includes(entry.id);
                const displayTitle = entry.route || entry.workType || 'Site Work Log';
                const entryPhotos = entry.photos || [];

                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntryForDetail(entry)}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/20'
                        : 'border-stone-200 hover:border-amber-500'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left & Center Info */}
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => toggleSelectEntry(entry.id, e)}
                          className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'border-stone-300 bg-stone-50 hover:border-amber-500 text-transparent'
                          }`}
                          title={isSelected ? 'Deselect this log' : 'Select this log'}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <div className="flex-1 min-w-0 space-y-2.5">
                          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs">
                            <span className="font-mono tabular-nums font-semibold text-stone-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{entry.date || formattedDate}</span>
                            </span>
                            <span aria-hidden="true" className="text-stone-300">·</span>
                            <span className="text-stone-500 font-mono tabular-nums">
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
                            {entryPhotos.length > 0 && (
                              <>
                                <span aria-hidden="true" className="text-stone-300">·</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                  <Camera className="w-3.5 h-3.5 shrink-0" />
                                  <span>{entryPhotos.length} Photo{entryPhotos.length > 1 ? 's' : ''}</span>
                                </span>
                              </>
                            )}
                          </div>

                          <h4 className="text-base sm:text-lg font-bold text-stone-900 break-words">
                            {displayTitle}
                          </h4>

                          {/* Clean 3-Column Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-stone-100 text-xs">
                            <div>
                              <span className="text-stone-500 block mb-0.5">Site Location</span>
                              <span className="font-semibold text-stone-900 flex items-start gap-1 break-words">
                                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>{entry.location || entry.locationFrom || 'Not specified'}</span>
                              </span>
                            </div>

                            <div>
                              <span className="text-stone-500 block mb-0.5">GPS Coordinates</span>
                              <span className="font-mono tabular-nums font-medium text-stone-800 flex items-start gap-1 break-all">
                                <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                                <span>{entry.latLong || 'Not recorded'}</span>
                              </span>
                            </div>

                            <div className="sm:col-span-2 lg:col-span-1">
                              <span className="text-stone-500 block mb-0.5">Remarks</span>
                              <span className="text-stone-700 line-clamp-2 break-words">
                                {entry.remark || 'No remarks'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Photo Previews & Actions */}
                      <div
                        className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entryPhotos.length > 0 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                            {entryPhotos.slice(0, 3).map((photo, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() =>
                                  setLightboxData({
                                    photos: entryPhotos,
                                    index: pIdx,
                                    title: `${displayTitle} · Photo #${pIdx + 1}`,
                                  })
                                }
                                className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-300 hover:border-amber-500 transition-colors shrink-0 cursor-pointer"
                              >
                                <img
                                  src={photo}
                                  alt={`Site Photo ${pIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                                {pIdx === 2 && entryPhotos.length > 3 && (
                                  <div className="absolute inset-0 bg-black/65 text-white text-xs font-bold flex items-center justify-center">
                                    +{entryPhotos.length - 3}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto sm:ml-auto lg:ml-0">
                          <button
                            type="button"
                            onClick={() => setEditingEntry(entry)}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingId(entry.id)}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShareEntry(entry)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                          >
                            Share
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedEntryForDetail(entry)}
                            className="flex-1 sm:flex-initial min-h-[36px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer"
                          >
                            <span>Details</span>
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
      )}

      {/* =====================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (Visible on Mobile & Small Screens)
          LEFT = Dashboard | MIDDLE = Daily Entry Log | RIGHT = Past Site Logs
      ===================================================================== */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 shadow-lg"
      >
        <div className="grid grid-cols-3 items-center h-16 max-w-lg mx-auto px-2">
          {/* LEFT: DASHBOARD */}
          <button
            type="button"
            onClick={() => {
              setActivePage('DASHBOARD');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activePage === 'DASHBOARD'
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 font-medium'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[11px] tracking-tight mt-0.5">Dashboard</span>
          </button>

          {/* MIDDLE: DAILY ENTRY LOG */}
          <button
            type="button"
            onClick={() => {
              setActivePage('ENTRY_LOG');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-[48px] flex flex-col items-center justify-center py-1 cursor-pointer"
          >
            <div
              className={`px-4 py-1.5 rounded-full flex items-center space-x-1.5 transition-all shadow-sm ${
                activePage === 'ENTRY_LOG'
                  ? 'bg-amber-600 text-white font-bold scale-105'
                  : 'bg-stone-900 dark:bg-amber-600/90 text-white font-semibold'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="text-[11px] whitespace-nowrap">Daily Entry Log</span>
            </div>
          </button>

          {/* RIGHT: PAST SITE LOGS */}
          <button
            type="button"
            onClick={() => {
              setActivePage('SITE_LOGS');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer relative ${
              activePage === 'SITE_LOGS'
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 font-medium'
            }`}
          >
            <div className="relative">
              <ClipboardList className="w-5 h-5" />
              {myEntries.length > 0 && (
                <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[9px] font-bold font-mono">
                  {myEntries.length}
                </span>
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-0.5">Past Site Logs</span>
          </button>
        </div>
      </nav>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          workTypes={workTypes}
          isOpen={Boolean(editingEntry)}
          onClose={() => setEditingEntry(null)}
          onSave={async (id, data) => {
            await updateEntry(id, data);
            setEditingEntry(null);
          }}
        />
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

      {/* Delete Confirmation Dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200">
            <h4 className="text-base font-bold text-stone-900 mb-2">Delete Work Entry?</h4>
            <p className="text-xs text-stone-600 mb-4">
              This action cannot be undone. Are you sure you want to permanently remove this entry?
            </p>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
