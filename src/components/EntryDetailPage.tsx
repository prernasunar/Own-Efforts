import React, { useState, useEffect } from 'react';
import { WorkEntry } from '../types';
import {
  ArrowLeft,
  Camera,
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Globe,
  FileText,
  Share2,
  Download,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User as UserIcon,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  Layers,
  Presentation,
} from 'lucide-react';
import { downloadPhoto, downloadAllPhotos } from '../utils/imageUtils';
import { exportSingleEntryToPpt } from '../utils/pptExporter';
import { PhotoLightbox } from './PhotoLightbox';

interface EntryDetailPageProps {
  entry: WorkEntry;
  onBack: () => void;
  onShare: (entry: WorkEntry) => void;
  onEdit?: (entry: WorkEntry) => void;
  onDelete?: (entry: WorkEntry) => void;
  onFilterByWorker?: (workerName: string) => void;
}

export const EntryDetailPage: React.FC<EntryDetailPageProps> = ({
  entry,
  onBack,
  onShare,
  onEdit,
  onDelete,
  onFilterByWorker,
}) => {
  const photos = entry.photos || [];
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);
  const [exportingPpt, setExportingPpt] = useState<boolean>(false);

  const handleExportSinglePpt = async () => {
    setExportingPpt(true);
    try {
      await exportSingleEntryToPpt(entry);
    } catch (err) {
      console.error('Error exporting single entry to PPT:', err);
    } finally {
      setExportingPpt(false);
    }
  };

  // Scroll to top when opening the detail page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActivePhotoIndex(0);
  }, [entry.id]);

  // Keyboard navigation (Escape to go back, Left/Right for photos)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (e.key === 'Escape') {
        onBack();
      } else if (e.key === 'ArrowLeft' && photos.length > 1) {
        setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
      } else if (e.key === 'ArrowRight' && photos.length > 1) {
        setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, onBack, photos.length]);

  const isDone = entry.status === 'Done';
  const displayTitle = entry.route || entry.workType || 'Site Work Log';

  const formattedLoggedTime = entry.createdAt?.toDate
    ? entry.createdAt.toDate().toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : entry.date || 'Just now';

  const formattedWorkDate = entry.date
    ? (() => {
        try {
          const [y, m, d] = entry.date.split('-').map(Number);
          if (y && m && d) {
            return new Date(y, m - 1, d).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        } catch {}
        return entry.date;
      })()
    : formattedLoggedTime;

  // Parse coordinates for Google Maps link if available
  const getGoogleMapsUrl = () => {
    if (entry.latLong) {
      const nums = entry.latLong.match(/-?\d+\.\d+/g);
      if (nums && nums.length >= 2) {
        return `https://www.google.com/maps?q=${nums[0]},${nums[1]}`;
      }
    }
    const loc = entry.location || entry.locationFrom;
    if (loc) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
    }
    return null;
  };

  const mapsUrl = getGoogleMapsUrl();

  const handleCopyCoords = () => {
    const textToCopy = entry.latLong || entry.location || entry.locationFrom || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 font-sans animate-in fade-in duration-200">
      {/* TOP NAVIGATION BAR */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-stone-200 flex flex-wrap items-center justify-between gap-3 sticky top-16 z-30">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          <span>Back to Field Entries</span>
        </button>

        <div className="flex items-center flex-wrap gap-2">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadAllPhotos(
                  photos,
                  `${(entry.userName || 'executive').replace(/\s+/g, '-')}-${entry.date || 'site'}`
                )
              }
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm border border-stone-300 transition-colors cursor-pointer"
              title="Download all photos from this entry"
            >
              <Download className="w-4 h-4 text-stone-700" />
              <span>Download Photos ({photos.length})</span>
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm border border-stone-300 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-stone-700" />
              <span>Edit Log</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(entry)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm border border-rose-200 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportSinglePpt}
            disabled={exportingPpt}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 active:bg-amber-900 text-white font-bold text-xs sm:text-sm shadow-xs border border-amber-600/40 transition-all cursor-pointer disabled:opacity-50"
            title="Download this work log as a PowerPoint (.pptx) presentation slide with photos"
          >
            <Presentation className="w-4 h-4 text-amber-200" />
            <span>{exportingPpt ? 'Exporting PPT...' : 'Export to PPT'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(entry)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-stone-950" />
            <span>Share Log</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          1. PHOTOS SECTION AT THE VERY TOP (HERO GALLERY)
      ===================================================================== */}
      <section className="bg-stone-900 rounded-2xl overflow-hidden shadow-lg border border-stone-800">
        <div className="px-4 sm:px-6 py-3.5 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                Site Work Photos ({photos.length})
              </h3>
              <p className="text-[11px] text-stone-400">
                {photos.length > 0
                  ? 'Click photo to view full-screen zoom or switch between site photos below'
                  : 'No photos were attached to this field entry'}
              </p>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() =>
                  downloadPhoto(
                    photos[activePhotoIndex],
                    `${(entry.userName || 'site').replace(/\s+/g, '-')}-photo-${activePhotoIndex + 1}.jpg`
                  )
                }
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Save Photo #{activePhotoIndex + 1}</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-400/30 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Screen</span>
              </button>
            </div>
          )}
        </div>

        {photos.length > 0 ? (
          <div className="p-3 sm:p-5 space-y-4">
            {/* Main Featured Photo Viewer */}
            <div className="relative w-full h-[280px] sm:h-[420px] md:h-[480px] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-stone-800 group">
              <img
                src={photos[activePhotoIndex]}
                alt={`Site Photo ${activePhotoIndex + 1}`}
                onClick={() => setLightboxOpen(true)}
                className="max-w-full max-h-full object-contain cursor-zoom-in transition-transform duration-200"
              />

              {/* Photo Counter Pill */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-xs font-black px-3 py-1 rounded-full border border-white/15">
                Photo #{activePhotoIndex + 1} of {photos.length}
              </div>

              {/* Prev / Next Controls if multiple photos */}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 shadow-lg transition-all cursor-pointer"
                    title="Previous Photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 shadow-lg transition-all cursor-pointer"
                    title="Next Photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip / Grid of All Photos */}
            {photos.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {photos.map((photo, idx) => {
                  const isActive = idx === activePhotoIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`relative aspect-video sm:aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-amber-400 ring-2 ring-amber-400/40 scale-[1.02]'
                          : 'border-stone-700 opacity-70 hover:opacity-100 hover:border-stone-500'
                      }`}
                    >
                      <img
                        src={photo}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-stone-400 space-y-2">
            <Camera className="w-10 h-10 text-stone-600 mx-auto" />
            <p className="text-sm font-bold text-stone-300">No Site Photos Attached</p>
            <p className="text-xs text-stone-500">
              This work log was submitted without camera photos.
            </p>
          </div>
        )}
      </section>

      {/* =====================================================================
          2. ENTRY HEADER & FIELD EXECUTIVE BANNER
      ===================================================================== */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-stone-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="flex items-start space-x-3.5">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 text-amber-900 font-black text-base flex items-center justify-center flex-shrink-0 shadow-2xs">
              {entry.userName
                ? entry.userName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'FE'}
            </div>

            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                  👷 Field Executive
                </span>
                <span
                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-black border ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-orange-100 text-orange-800 border-orange-300'
                  }`}
                >
                  {isDone ? '✅ Status: Done' : '⏳ Status: Pending'}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1.5 tracking-tight">
                {displayTitle}
              </h1>

              <div className="flex items-center space-x-2 mt-1 text-xs sm:text-sm text-stone-600 flex-wrap">
                <span>Submitted by:</span>
                {onFilterByWorker ? (
                  <button
                    type="button"
                    onClick={() => onFilterByWorker(entry.userName)}
                    className="font-black text-stone-900 hover:text-amber-700 underline decoration-amber-400 cursor-pointer"
                  >
                    {entry.userName}
                  </button>
                ) : (
                  <strong className="font-black text-stone-900">{entry.userName}</strong>
                )}
              </div>
            </div>
          </div>

          {/* Work Date & Logged Time Pill Box */}
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex flex-col space-y-1.5 min-w-[210px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-500 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Work Date:</span>
              </span>
              <span className="font-black text-stone-900">{formattedWorkDate}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200/80">
              <span className="font-bold text-stone-500 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Logged Time:</span>
              </span>
              <span className="font-semibold text-stone-700">{formattedLoggedTime}</span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            3. COMPLETE FIELD LOG DETAILS GRID
        ===================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Route / Section Card */}
          <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/80 space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-amber-900">
              <Navigation className="w-4 h-4 text-amber-600" />
              <span>Route / Trench Section</span>
            </div>
            <p className="text-sm sm:text-base font-black text-stone-900 break-words">
              {entry.route || entry.workType || 'Not specified'}
            </p>
          </div>

          {/* Location Card */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-stone-700">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>Site Location</span>
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-xs font-bold text-amber-700 hover:text-amber-900 underline"
                >
                  <span>View on Map</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-sm sm:text-base font-bold text-stone-900 break-words">
              {entry.location || entry.locationFrom || 'Location not specified'}
            </p>
            {entry.locationTo && (
              <p className="text-xs font-semibold text-stone-600 pt-1">
                To: <span className="text-stone-900">{entry.locationTo}</span>
              </p>
            )}
          </div>

          {/* Lat & Long GPS Coordinates Card */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-stone-700">
                <Globe className="w-4 h-4 text-amber-600" />
                <span>Lat & Long (GPS Coordinates)</span>
              </div>
              {(entry.latLong || entry.location) && (
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-300 cursor-pointer"
                >
                  {copiedCoords ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-sm font-mono font-bold text-stone-900 bg-white px-3 py-2 rounded-lg border border-stone-200 break-words">
              {entry.latLong || 'No GPS coordinates recorded'}
            </p>
          </div>

          {/* Work Type & Measurement / Status Card */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-stone-700">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>Work Category & Status</span>
            </div>
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <div>
                <span className="text-xs text-stone-500 block">Work Type:</span>
                <span className="text-sm font-extrabold text-stone-900">
                  {entry.workType || entry.route || 'Civil Site Work'}
                </span>
              </div>
              {entry.quantity && entry.quantity > 0 && (
                <div className="bg-white px-3 py-1.5 rounded-lg border border-stone-200">
                  <span className="text-xs text-stone-500 block">Quantity:</span>
                  <span className="text-sm font-black text-stone-900">
                    {entry.quantity} {entry.uom || 'meter'}
                  </span>
                </div>
              )}
              <div className="bg-white px-3 py-1.5 rounded-lg border border-stone-200">
                <span className="text-xs text-stone-500 block">Completion:</span>
                <span
                  className={`text-sm font-black ${
                    isDone ? 'text-emerald-700' : 'text-orange-700'
                  }`}
                >
                  {entry.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Remark / Detailed Work Description */}
        <div className="bg-stone-50 rounded-xl p-4 sm:p-5 border border-stone-200 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-stone-700">
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Work Remark / Site Notes</span>
          </div>
          <p className="text-sm sm:text-base text-stone-800 font-medium leading-relaxed whitespace-pre-wrap break-words bg-white p-3.5 rounded-xl border border-stone-200">
            {entry.remark ? entry.remark : 'No additional remarks provided for this work entry.'}
          </p>
        </div>

        {/* Footer Metadata */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-400 border-t border-stone-100">
          <span>
            Entry ID: <code className="font-mono text-stone-500">{entry.id}</code>
          </span>
          <span>
            Verified Field Executive Submission • Logged {formattedLoggedTime}
          </span>
        </div>
      </section>

      {/* Full-Screen Lightbox when clicking the main photo */}
      {lightboxOpen && photos.length > 0 && (
        <PhotoLightbox
          isOpen={lightboxOpen}
          photos={photos}
          initialIndex={activePhotoIndex}
          title={`${entry.userName} • ${displayTitle}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};
