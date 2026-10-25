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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActivePhotoIndex(0);
  }, [entry.id]);

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
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 font-sans">
      {/* TOP NAVIGATION BAR */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] inline-flex items-center justify-center sm:justify-start space-x-2 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          <span>Back</span>
        </button>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:flex-wrap gap-2 w-full sm:w-auto">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadAllPhotos(
                  photos,
                  `${(entry.userName || 'executive').replace(/\s+/g, '-')}-${entry.date || 'site'}`
                )
              }
              className="min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Download all photos from this entry"
            >
              <Download className="w-4 h-4 text-stone-700 shrink-0" />
              <span>Photos ({photos.length})</span>
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Edit2 className="w-4 h-4 text-stone-700 shrink-0" />
              <span>Edit</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(entry)}
              className="min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportSinglePpt}
            disabled={exportingPpt}
            className="min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            title="Download this work log as a PowerPoint (.pptx) presentation slide with photos"
          >
            <Presentation className="w-4 h-4 text-amber-200 shrink-0" />
            <span>{exportingPpt ? 'Exporting...' : 'Export PPT'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(entry)}
            className="min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4 text-stone-950 shrink-0" />
            <span>Share Log</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          1. PHOTOS SECTION AT THE VERY TOP (HERO GALLERY)
      ===================================================================== */}
      <section className="bg-stone-900 rounded-2xl overflow-hidden border border-stone-800">
        <div className="px-4 sm:px-5 py-3.5 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Camera className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              Site Work Photos ({photos.length})
            </h3>
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
                className="min-h-[34px] inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Save #{activePhotoIndex + 1}</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="min-h-[34px] inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-400/30 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Zoom</span>
              </button>
            </div>
          )}
        </div>

        {photos.length > 0 ? (
          <div className="p-3 sm:p-5 space-y-3.5">
            <div className="relative w-full h-[240px] sm:h-[400px] md:h-[480px] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-stone-800">
              <img
                src={photos[activePhotoIndex]}
                alt={`Site Photo ${activePhotoIndex + 1}`}
                referrerPolicy="no-referrer"
                onClick={() => setLightboxOpen(true)}
                className="max-w-full max-h-full object-contain cursor-zoom-in transition-transform duration-200"
              />

              <div className="absolute top-3 left-3 bg-black/75 text-white text-xs font-mono tabular-nums font-semibold px-3 py-1 rounded-md border border-white/15">
                Photo {activePhotoIndex + 1} / {photos.length}
              </div>

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 transition-all cursor-pointer"
                    title="Previous Photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 transition-all cursor-pointer"
                    title="Next Photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {photos.map((photo, idx) => {
                  const isActive = idx === activePhotoIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`relative aspect-video sm:aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-amber-400'
                          : 'border-stone-700 opacity-70 hover:opacity-100 hover:border-stone-500'
                      }`}
                    >
                      <img
                        src={photo}
                        alt={`Thumbnail ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
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
          2. COMPLETE FIELD LOG DETAILS
      ===================================================================== */}
      <section className="bg-white rounded-xl p-5 sm:p-6 border border-stone-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-stone-200">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-600 text-white font-bold text-base flex items-center justify-center shrink-0">
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
              <div className="flex items-center gap-2 text-xs text-stone-500 flex-wrap">
                <span>Field Executive</span>
                <span aria-hidden="true">·</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    isDone ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completed (Done)</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending</span>
                    </>
                  )}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 tracking-tight">
                {displayTitle}
              </h1>

              <div className="flex items-center space-x-2 mt-1 text-xs sm:text-sm text-stone-600 flex-wrap">
                <span>Submitted by:</span>
                {onFilterByWorker ? (
                  <button
                    type="button"
                    onClick={() => onFilterByWorker(entry.userName)}
                    className="font-bold text-stone-900 hover:text-amber-700 underline decoration-amber-500 cursor-pointer"
                  >
                    {entry.userName}
                  </button>
                ) : (
                  <strong className="font-bold text-stone-900">{entry.userName}</strong>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs space-y-1.5 sm:text-right font-mono tabular-nums">
            <div className="text-stone-500">
              Work Date: <strong className="text-stone-900">{formattedWorkDate}</strong>
            </div>
            <div className="text-stone-500">
              Logged Time: <span className="text-stone-700">{formattedLoggedTime}</span>
            </div>
          </div>
        </div>

        {/* Clean 2x2 Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-stone-500">
              <Navigation className="w-4 h-4 text-amber-600" />
              <span>Route / Section</span>
            </div>
            <p className="text-sm sm:text-base font-bold text-stone-900 break-words">
              {entry.route || entry.workType || 'Not specified'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-stone-500">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>Site Location</span>
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
                >
                  <span>Open in Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-sm sm:text-base font-bold text-stone-900 break-words">
              {entry.location || entry.locationFrom || 'Location not specified'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-stone-500">
                <Globe className="w-4 h-4 text-amber-600" />
                <span>GPS Coordinates (Lat & Long)</span>
              </div>
              {(entry.latLong || entry.location) && (
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  {copiedCoords ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-sm font-mono tabular-nums font-semibold text-stone-900 break-words">
              {entry.latLong || 'No GPS coordinates recorded'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-stone-500">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>Category & Status</span>
            </div>
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2 text-sm">
              <span className="font-bold text-stone-900">
                {entry.workType || entry.route || 'Civil Site Work'}
              </span>
              <span
                className={`font-semibold ${
                  isDone ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                Status: {entry.status}
              </span>
            </div>
          </div>
        </div>

        {/* Remark / Detailed Work Description */}
        <div className="p-4 sm:p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-stone-500">
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Work Remark / Site Notes</span>
          </div>
          <p className="text-sm sm:text-base text-stone-800 leading-relaxed whitespace-pre-wrap break-words">
            {entry.remark ? entry.remark : 'No additional remarks provided for this work entry.'}
          </p>
        </div>
      </section>

      {lightboxOpen && photos.length > 0 && (
        <PhotoLightbox
          isOpen={lightboxOpen}
          photos={photos}
          initialIndex={activePhotoIndex}
          title={`${entry.userName} · ${displayTitle}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};
