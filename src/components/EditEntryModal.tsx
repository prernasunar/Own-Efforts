import React, { useState } from 'react';
import { WorkEntry, EntryStatus, WorkTypeItem } from '../types';
import { X, CheckCircle2, Clock, MapPin, Loader2, Sparkles, Navigation, Calendar } from 'lucide-react';
import { captureCurrentLocation } from '../utils/geo';
import { PhotoUploader } from './PhotoUploader';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoGpsData } from '../utils/photoGpsExtractor';

interface EditEntryModalProps {
  entry: WorkEntry;
  workTypes?: WorkTypeItem[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<WorkEntry>) => Promise<void>;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  entry,
  isOpen,
  onClose,
  onSave,
}) => {
  // Worker View Requested Fields
  const getInitialDate = () => {
    if (entry.date) return entry.date;
    if (entry.createdAt?.toDate) {
      return entry.createdAt.toDate().toLocaleDateString('en-CA');
    }
    return new Date().toLocaleDateString('en-CA');
  };
  const [date, setDate] = useState<string>(getInitialDate);
  const [route, setRoute] = useState<string>(entry.route || '');
  const [location, setLocation] = useState<string>(entry.location || entry.locationFrom || '');
  const [latLong, setLatLong] = useState<string>(entry.latLong || '');
  const [remark, setRemark] = useState<string>(entry.remark || '');
  const [photos, setPhotos] = useState<string[]>(entry.photos || []);
  const [status, setStatus] = useState<EntryStatus>(entry.status);

  const [lightboxData, setLightboxData] = useState<{ index: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCaptureLiveGps = async () => {
    setError(null);
    setGpsLoading(true);

    try {
      const result = await captureCurrentLocation();
      setLocation(result.formattedAddress);
      const coords = `Lat ${result.latitude.toFixed(6)}° Long ${result.longitude.toFixed(6)}°`;
      setLatLong(coords);
      setGpsNotice(`📍 Live GPS Captured: ${coords}`);
      setTimeout(() => setGpsNotice(null), 5000);
    } catch (err: any) {
      setError(err.message || 'GPS location capture failed');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleGpsExtracted = (gpsData: PhotoGpsData) => {
    const coordsStr =
      gpsData.formattedCoords || `Lat ${gpsData.latitude.toFixed(6)}° Long ${gpsData.longitude.toFixed(6)}°`;
    const locStr = gpsData.address || gpsData.formattedLocation || gpsData.city || '';

    setLatLong(coordsStr);
    if (locStr) {
      setLocation(locStr);
    }

    setGpsNotice(`📍 Auto-filled Lat & Log: ${coordsStr}`);
    setTimeout(() => setGpsNotice(null), 6000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSaving(true);
    try {
      await onSave(entry.id, {
        date,
        route: route.trim(),
        location: location.trim(),
        latLong: latLong.trim(),
        locationFrom: location.trim(),
        remark: remark.trim(),
        photos,
        status,
        workType: route.trim() || entry.workType || 'Site Work',
        quantity: entry.quantity ?? 1,
        uom: entry.uom || 'meter',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl border border-stone-200 my-auto max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-stone-900">Edit Site Work Log</h3>
            <p className="text-xs text-stone-500">Date • Route • Location • Lat & Log • Remark • Photos</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {gpsNotice && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{gpsNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Work Date Section (Editable) & Logged Time (Locked / Not Editable) */}
          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Work Date / तारीख</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                    Editable
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setDate(new Date().toLocaleDateString('en-CA'))}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 hover:underline"
                >
                  Set Today
                </button>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-stone-700 font-bold">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Logged Time:</span>
                <span className="text-[10px] font-bold text-stone-600 bg-stone-200/90 px-1.5 py-0.5 rounded border border-stone-300">
                  🔒 Not Editable
                </span>
              </div>
              <span className="font-mono font-bold text-stone-800 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-300 select-none">
                {entry.createdAt?.toDate
                  ? entry.createdAt.toDate().toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'System Recorded'}
              </span>
            </div>
          </div>

          {/* 1. Route */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1 flex items-center space-x-1">
              <Navigation className="w-3.5 h-3.5 text-amber-600" />
              <span>Route / Section</span>
            </label>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="e.g. Route 4 / Nerul-Juinagar Link / Trench Section A"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* 2. Location */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-stone-800 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Location</span>
              </label>
              <button
                type="button"
                onClick={handleCaptureLiveGps}
                disabled={gpsLoading}
                className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300 transition-colors"
              >
                {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3 text-amber-700" />}
                <span>Live GPS</span>
              </button>
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Anirudha Bhawan, Sector 23, Juinagar, Navi Mumbai"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* 3. Lat & Log */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              Lat & Log (Coordinates)
            </label>
            <input
              type="text"
              value={latLong}
              onChange={(e) => setLatLong(e.target.value)}
              placeholder="e.g. Lat 19.053155° Long 73.016608°"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-bold font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none bg-stone-50"
            />
          </div>

          {/* 4. Remark */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              Remark / Site Notes
            </label>
            <textarea
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional remarks or observations..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* 5. Photos Management (Click or Upload) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              Site Photos (GPS Camera / Upload)
            </label>
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              maxPhotos={4}
              disabled={saving}
              onGpsExtracted={handleGpsExtracted}
              onPreviewPhoto={(idx) => setLightboxData({ index: idx })}
            />
          </div>

          {/* 6. Status */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('Pending')}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                  status === 'Pending'
                    ? 'border-orange-500 bg-orange-50 text-orange-950 font-black'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>⏳ Pending</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('Done')}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                  status === 'Done'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>✅ Done</span>
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-100 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors text-sm shadow-md flex items-center justify-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {lightboxData && (
        <PhotoLightbox
          isOpen={Boolean(lightboxData)}
          photos={photos}
          initialIndex={lightboxData.index}
          title={`${route || 'Site Work'} - Photo #${lightboxData.index + 1}`}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
};
