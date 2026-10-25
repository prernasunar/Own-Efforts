import React, { useState } from 'react';
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
  Filter,
  Eye,
} from 'lucide-react';
import { captureCurrentLocation } from '../utils/geo';
import { formatSingleEntryText, formatWorkerBatchReportText } from '../utils/share';
import { EditEntryModal } from './EditEntryModal';
import { ShareModal } from './ShareModal';
import { PhotoUploader } from './PhotoUploader';
import { PhotoLightbox } from './PhotoLightbox';
import { EntryDetailPage } from './EntryDetailPage';
import { PhotoGpsData } from '../utils/photoGpsExtractor';

export const FieldWorkerDashboard: React.FC = () => {
  const { userProfile, user } = useAuth();
  const { myEntries, createEntry, updateEntry, deleteEntry, workTypes } = useWorkData();

  // Core Worker View Form Fields (Date, Route, Location, Lat & Log, Remark, Photos, Status)
  const getTodayIso = () => new Date().toLocaleDateString('en-CA');
  const [date, setDate] = useState<string>(getTodayIso);
  const [route, setRoute] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [latLong, setLatLong] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<EntryStatus>('Done');

  // Quick Date Selectors
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

  // Filter & Search state for past logs
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Pending' | 'Done'>('ALL');

  // Auto-fill and notification states
  const [lastDetectedGps, setLastDetectedGps] = useState<PhotoGpsData | null>(null);
  const [gpsAutoFillNotice, setGpsAutoFillNotice] = useState<string | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  // Multi-select batch sharing state
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  // Modals, Lightbox & Detail Page state
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<WorkEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{ title: string; text: string; photos?: string[] } | null>(null);
  const [lightboxData, setLightboxData] = useState<{ photos: string[]; index: number; title: string } | null>(null);

  // Live GPS Capture button for the Location field
  const handleCaptureLiveLocation = async () => {
    setFormError(null);
    setGpsLoading(true);

    try {
      const geo = await captureCurrentLocation();
      setLocation(geo.formattedAddress);
      const coordsString = `Lat ${geo.latitude.toFixed(6)}° Long ${geo.longitude.toFixed(6)}°`;
      setLatLong(coordsString);
      setGpsAutoFillNotice(`📍 Live GPS detected & filled: ${coordsString}`);
      setTimeout(() => setGpsAutoFillNotice(null), 6000);
    } catch (err: any) {
      setFormError(err.message || 'Live GPS capture failed. You can type location manually or upload photo.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Automatic callback when GPS is extracted from Uploaded or Clicked Photo!
  const handleGpsExtracted = (gpsData: PhotoGpsData, photoIndex: number) => {
    setLastDetectedGps(gpsData);

    const coordsStr =
      gpsData.formattedCoords || `Lat ${gpsData.latitude.toFixed(6)}° Long ${gpsData.longitude.toFixed(6)}°`;
    const locStr = gpsData.address || gpsData.formattedLocation || gpsData.city || '';

    // Automatically fill Lat & Log field
    setLatLong(coordsStr);

    // If location is empty or extracted has rich address, fill Location field
    if (locStr) {
      setLocation(locStr);
    }

    setGpsAutoFillNotice(
      `✅ Photo #${photoIndex + 1} GPS Detected: Auto-filled Lat & Log (${coordsStr})${
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
      setFormError('Please enter at least Route, Location, Lat & Log, or take/upload a photo.');
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
      // Reset remark and photos, keep route/location for rapid logging along the same route
      setRemark('');
      setPhotos([]);
      setTimeout(() => setFormSuccess(false), 3500);
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

    const text = formatWorkerBatchReportText(
      selected,
      userProfile?.name || user?.displayName || 'Site Worker'
    );
    const batchPhotos = selected.flatMap((e) => e.photos || []);

    setShareData({
      title: `Share ${selected.length} Selected Work${selected.length > 1 ? 's' : ''}`,
      text,
      photos: batchPhotos,
    });
  };

  // Filter entries
  const filteredMyEntries = myEntries.filter((entry) => {
    if (filterStatus !== 'ALL' && entry.status !== filterStatus) return false;
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

  const selectedEntries = myEntries.filter((e) => selectedEntryIds.includes(e.id));
  const selectedPhotosCount = selectedEntries.reduce(
    (sum, e) => sum + (e.photos?.length || 0),
    0
  );

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
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
              <h4 className="text-base font-bold text-stone-900 mb-2">Delete Work Entry?</h4>
              <p className="text-xs text-stone-600 mb-4">
                This action cannot be undone. Are you sure you want to permanently remove this entry?
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleDeleteConfirm(deletingId);
                    setSelectedEntryForDetail(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm"
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 font-sans">
      {/* Worker Greeting Banner - Full Width Hero */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-2xl p-4 sm:p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-700/80 text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1 border border-amber-400/30">
            👷 Active Field Executive
          </span>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
            {userProfile?.name || user?.displayName || 'Site Engineer'}
          </h2>
          <p className="text-xs sm:text-sm text-amber-100 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Log site progress with Route, Location, GPS Map Camera, and auto-extracted Lat & Log coordinates.
          </p>
        </div>

        <div className="bg-amber-700/70 border border-amber-300/35 rounded-xl px-4 py-2.5 text-right self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end flex-shrink-0">
          <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">Logged Today</span>
          <span className="text-xl sm:text-2xl font-black text-white">{myEntries.length} logs</span>
        </div>
      </div>

      {/* RESPONSIVE LAYOUT:
          - On Mobile & Tablet (<1024px): 1-column vertical flow
          - On Desktop (>=1024px / lg:): 2-column layout with pinned form on left, feed on right
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CORE WORKER ENTRY FORM (Sticky on Desktop) */}
        <section className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-24 bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-stone-200 space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-stone-200">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold shadow-2xs flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                  Daily Work Entry Log
                </h3>
                <p className="text-xs text-stone-500">
                  Route • Location • Lat & Log • Remark • GPS Camera
                </p>
              </div>
            </div>
          </div>

          {/* Success Alert */}
          {formSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center space-x-3 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-xs sm:text-sm">Site Work Logged Successfully!</p>
                <p className="text-[11px] text-emerald-700">
                  Synced to cloud and visible on manager dashboard in real time.
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-semibold">{formError}</p>
            </div>
          )}

          {/* Automatic GPS Auto-fill Notification */}
          {gpsAutoFillNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between shadow-xs animate-fadeIn">
              <div className="flex items-center space-x-2 min-w-0">
                <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs font-bold truncate">{gpsAutoFillNotice}</p>
              </div>
              <button
                type="button"
                onClick={() => setGpsAutoFillNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 text-xs font-black px-1.5 py-0.5 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* DATE SECTION (Default Current Date & Fully Editable) */}
            <div className="bg-gradient-to-r from-amber-50/90 to-orange-50/70 p-3.5 sm:p-4 rounded-2xl border-2 border-amber-200/90 shadow-2xs">
              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-2">
                <label className="text-xs font-black text-amber-950 flex items-center space-x-1.5 flex-wrap gap-1">
                  <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Date / कार्य दिनांक</span>
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">
                    Editable
                  </span>
                </label>

                {/* Quick Selectors: Today / Yesterday */}
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={setTodayDate}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all border ${
                      date === getTodayIso()
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    📅 Today
                  </button>
                  <button
                    type="button"
                    onClick={setYesterdayDate}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all border ${
                      date !== getTodayIso()
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    ⏮️ Yesterday
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-300 bg-white text-stone-900 text-sm font-black focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors shadow-2xs"
                  />
                </div>
                <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-700 bg-white/95 px-3 py-2 rounded-xl border border-amber-200 shadow-2xs flex-shrink-0 justify-between sm:justify-start">
                  <span className="text-stone-400">Selected:</span>
                  <span className="text-amber-900 font-black truncate">{formatDisplayDate(date)}</span>
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
                <span className="text-[10px] text-stone-400 font-normal hidden sm:inline">e.g. Route 4, Trench Sec B</span>
              </div>
              <input
                type="text"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. Route 4 / Nerul-Juinagar Link / Sector 23 Feeder"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-300 text-stone-900 text-sm font-semibold placeholder-stone-400 focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
              />
            </div>

            {/* 2. LOCATION FIELD */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Location</span>
                </label>
                <button
                  type="button"
                  onClick={handleCaptureLiveLocation}
                  disabled={gpsLoading}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-950 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-2xs"
                  title="Fetch live street address and coordinates"
                >
                  {gpsLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-amber-800" />
                  ) : (
                    <Compass className="w-3 h-3 text-amber-700" />
                  )}
                  <span>Live GPS</span>
                </button>
              </div>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Auto-filled from Photo or Live GPS"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-300 text-stone-900 text-sm font-medium placeholder-stone-400 focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
              />
            </div>

            {/* 3. LAT & LOG (COORDINATES) FIELD - Auto-filled from uploaded/clicked photo! */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lat & Log (Auto-detected from photo / GPS)</span>
                </label>
                {latLong && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center space-x-0.5">
                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                    <span>GPS Synced</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={latLong}
                  onChange={(e) => setLatLong(e.target.value)}
                  placeholder="e.g. Lat 19.053155° Long 73.016608°"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-300 text-stone-900 text-xs sm:text-sm font-black font-mono bg-stone-50/70 focus:bg-white placeholder-stone-400 focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-[10px] font-bold text-stone-400">GPS</span>
                </div>
              </div>
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
                className="w-full px-3.5 py-2 rounded-xl border-2 border-stone-300 text-stone-900 text-sm font-medium focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
              />
            </div>

            {/* 5. UPLOAD & CLICK PHOTO OPTIONS (Live GPS Map Camera + Auto Extraction) */}
            <div className="pt-0.5">
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
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Work Status
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatus('Pending')}
                  className={`py-2.5 sm:py-3 px-3 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition-all shadow-xs min-h-[46px] ${
                    status === 'Pending'
                      ? 'border-orange-500 bg-orange-50 text-orange-950 ring-2 ring-orange-400/40'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Clock
                    className={`w-4 h-4 ${
                      status === 'Pending' ? 'text-orange-600' : 'text-stone-400'
                    }`}
                  />
                  <span>⏳ Pending</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('Done')}
                  className={`py-2.5 sm:py-3 px-3 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition-all shadow-xs min-h-[46px] ${
                    status === 'Done'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-400/40'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      status === 'Done' ? 'text-emerald-600' : 'text-stone-400'
                    }`}
                  />
                  <span>✅ Done</span>
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black text-sm sm:text-base shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-400/50 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 active:scale-[0.99]"
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

        {/* RIGHT COLUMN: MY PAST SITE LOGS WITH SEARCH, BATCH SHARING, PHOTO GALLERY */}
        <section className="lg:col-span-7 xl:col-span-7 space-y-4">
          {/* Header & Controls */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight flex items-center space-x-2">
                  <span>My Past Site Logs</span>
                  <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full border border-stone-200">
                    {filteredMyEntries.length} of {myEntries.length}
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  Select multiple entries to batch send to your manager via WhatsApp
                </p>
              </div>

              {myEntries.length > 0 && (
                <div className="flex items-center space-x-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 shadow-2xs transition-colors"
                  >
                    {selectedEntryIds.length === filteredMyEntries.length && filteredMyEntries.length > 0 ? (
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
                </div>
              )}
            </div>

            {/* Quick Filter & Search Bar for worker's logs */}
            {myEntries.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-stone-100">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search route, location, or remarks..."
                    className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery('')}
                      className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      filterStatus === 'ALL'
                        ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    All ({myEntries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('Done')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      filterStatus === 'Done'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('Pending')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      filterStatus === 'Pending'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                        : 'bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-100'
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Batch Action Bar (Sticky with safe-area spacing) */}
          {selectedEntryIds.length > 0 && (
            <div className="sticky top-16 z-30 p-3.5 sm:p-4 rounded-2xl bg-stone-900 text-white shadow-xl border border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <p className="font-extrabold text-sm sm:text-base text-white truncate">
                      {selectedEntryIds.length} Work{selectedEntryIds.length > 1 ? 's' : ''} Selected
                    </p>
                    {selectedPhotosCount > 0 && (
                      <span className="bg-amber-800 text-amber-200 border border-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-1">
                        <Camera className="w-2.5 h-2.5" />
                        <span>{selectedPhotosCount} photos</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-300 hidden sm:block">
                    Ready to send together via WhatsApp, Telegram, or device share
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-colors"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={handleSendSelectedBatch}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-[0.98]"
                >
                  <SendHorizontal className="w-4 h-4" />
                  <span>Send {selectedEntryIds.length} Works at Once</span>
                </button>
              </div>
            </div>
          )}

          {/* Past Logs Feed Cards */}
          {myEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border-2 border-dashed border-stone-200">
              <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="font-bold text-stone-700 text-base">No work logs submitted yet.</p>
              <p className="text-xs text-stone-500 mt-1">
                Use the form to log your first civil work item today.
              </p>
            </div>
          ) : filteredMyEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-stone-200">
              <p className="font-bold text-stone-700 text-sm">No entries match your search or filter.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterQuery('');
                  setFilterStatus('ALL');
                }}
                className="mt-2 text-xs font-bold text-amber-600 hover:underline"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
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
                const formattedWorkDate = entry.date
                  ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntryForDetail(entry)}
                    className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-400/50 bg-amber-50/25'
                        : 'border-stone-200 hover:border-amber-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5 mb-2.5">
                      <div className="flex items-start space-x-2.5 sm:space-x-3 min-w-0">
                        {/* Checkbox selector */}
                        <button
                          type="button"
                          onClick={(e) => toggleSelectEntry(entry.id, e)}
                          className={`mt-0.5 p-1 rounded-lg border transition-colors flex-shrink-0 ${
                            isSelected
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'border-stone-300 bg-stone-50 hover:border-amber-400 text-transparent'
                          }`}
                          title={isSelected ? 'Deselect this log' : 'Select this log to send'}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-base sm:text-lg font-black text-stone-900 truncate">
                              {displayTitle}
                            </h4>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black border ${
                                isDone
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-orange-100 text-orange-800 border-orange-300'
                              }`}
                            >
                              {isDone ? '✅ Done' : '⏳ Pending'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-stone-500 mt-1 flex-wrap gap-y-1">
                            <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-amber-600" />
                              <span>Date: {entry.date || formattedWorkDate || 'Today'}</span>
                            </span>
                            <span className="text-stone-400">• Logged: {formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Photo count indicator */}
                      {entry.photos && entry.photos.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 text-right flex-shrink-0 flex items-center space-x-1 text-amber-800">
                          <Camera className="w-3.5 h-3.5" />
                          <span className="text-xs font-black">{entry.photos.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Route, Location, Lat & Log, Remark Details */}
                    <div className="bg-stone-50 rounded-xl p-3 text-xs space-y-1.5 border border-stone-200/80 mb-3">
                      {/* Work Date */}
                      {formattedWorkDate && (
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-stone-600 flex items-center space-x-1 flex-shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>Work Date:</span>
                          </span>
                          <span className="font-extrabold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                            {formattedWorkDate} ({entry.date})
                          </span>
                        </div>
                      )}

                      {/* Route */}
                      {entry.route && (
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-stone-600 flex items-center space-x-1 flex-shrink-0">
                            <Navigation className="w-3.5 h-3.5 text-amber-600" />
                            <span>Route:</span>
                          </span>
                          <span className="font-extrabold text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200 truncate">
                            {entry.route}
                          </span>
                        </div>
                      )}

                      {/* Location */}
                      {(entry.location || entry.locationFrom) && (
                        <div className="flex items-start space-x-2">
                          <span className="font-bold text-stone-600 flex items-center space-x-1 flex-shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-amber-600" />
                            <span>Location:</span>
                          </span>
                          <span className="font-semibold text-stone-900 break-words">
                            {entry.location || entry.locationFrom}
                          </span>
                        </div>
                      )}

                      {/* Lat & Log */}
                      {entry.latLong && (
                        <div className="flex items-start space-x-2">
                          <span className="font-bold text-stone-600 flex items-center space-x-1 flex-shrink-0">
                            <Globe className="w-3.5 h-3.5 text-amber-600" />
                            <span>Lat & Log:</span>
                          </span>
                          <span className="font-bold text-stone-900 font-mono bg-white px-2 py-0.5 rounded border border-stone-200 break-words">
                            {entry.latLong}
                          </span>
                        </div>
                      )}

                      {/* Remark */}
                      {entry.remark && (
                        <div className="pt-1 border-t border-stone-200/60 flex items-start space-x-2">
                          <span className="font-bold text-stone-600 flex-shrink-0">Remark:</span>
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxData({
                                    photos: entry.photos || [],
                                    index: pIdx,
                                    title: `${displayTitle} • Photo #${pIdx + 1}`,
                                  });
                                }}
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

                    {/* Actions Row */}
                    <div
                      className="flex items-center justify-between pt-1 border-t border-stone-100 flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setDeletingId(entry.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedEntryForDetail(entry)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleSelectEntry(entry.id)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          <span>{isSelected ? 'Selected' : 'Select'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareEntry(entry)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-black text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-xs"
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
      </div>

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
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-base font-bold text-stone-900 mb-2">Delete Work Entry?</h4>
            <p className="text-xs text-stone-600 mb-4">
              This action cannot be undone. Are you sure you want to permanently remove this entry?
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm"
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
