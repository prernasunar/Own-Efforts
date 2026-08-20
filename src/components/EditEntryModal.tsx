import React, { useState } from 'react';
import { WorkEntry, EntryStatus, WorkTypeItem, UOMType } from '../types';
import { X, CheckCircle2, Clock, MapPin, Loader2, Sparkles, Copy, ArrowUpDown } from 'lucide-react';
import { captureCurrentLocation } from '../utils/geo';
import { PhotoUploader } from './PhotoUploader';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoGpsData } from '../utils/photoGpsExtractor';

interface EditEntryModalProps {
  entry: WorkEntry;
  workTypes: WorkTypeItem[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<WorkEntry>) => Promise<void>;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  entry,
  workTypes,
  isOpen,
  onClose,
  onSave,
}) => {
  const [workType, setWorkType] = useState(entry.workType);
  const [uom, setUom] = useState<UOMType>(entry.uom);
  const [quantity, setQuantity] = useState<string>(String(entry.quantity));
  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [locationFrom, setLocationFrom] = useState(entry.locationFrom);
  const [locationTo, setLocationTo] = useState(entry.locationTo);
  const [remark, setRemark] = useState(entry.remark || '');
  const [photos, setPhotos] = useState<string[]>(entry.photos || []);
  const [lightboxData, setLightboxData] = useState<{ index: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [gpsLoadingFrom, setGpsLoadingFrom] = useState(false);
  const [gpsLoadingTo, setGpsLoadingTo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [lastDetectedGps, setLastDetectedGps] = useState<PhotoGpsData | null>(null);

  if (!isOpen) return null;

  const handleWorkTypeChange = (selectedName: string) => {
    setWorkType(selectedName);
    const found = workTypes.find((wt) => wt.name === selectedName);
    if (found) {
      setUom(found.uom);
    }
  };

  const handleCaptureGps = async (field: 'from' | 'to') => {
    setError(null);
    if (field === 'from') setGpsLoadingFrom(true);
    else setGpsLoadingTo(true);

    try {
      const result = await captureCurrentLocation();
      if (field === 'from') {
        setLocationFrom(result.formattedAddress);
      } else {
        setLocationTo(result.formattedAddress);
      }
    } catch (err: any) {
      setError(err.message || 'GPS location capture failed');
    } finally {
      if (field === 'from') setGpsLoadingFrom(false);
      else setGpsLoadingTo(false);
    }
  };

  const handleGpsExtracted = (gpsData: PhotoGpsData, photoIndex: number) => {
    setLastDetectedGps(gpsData);
    const loc = gpsData.formattedLocation;

    if (photoIndex === 0) {
      setLocationFrom(loc);
      setLocationTo(loc);
      setGpsNotice(`📍 Extracted GPS from Photo: Auto-filled From & To (${loc})`);
    } else {
      setLocationTo(loc);
      setGpsNotice(`📍 Updated Location To with Photo #${photoIndex + 1} GPS (${loc})`);
    }

    setTimeout(() => setGpsNotice(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(quantity);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid positive quantity');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave(entry.id, {
        workType,
        uom,
        quantity: num,
        status,
        locationFrom: locationFrom.trim(),
        locationTo: locationTo.trim(),
        remark: remark.trim(),
        photos,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-stone-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Edit Work Entry</h3>
            <p className="text-xs text-stone-500">Log ID: {entry.id}</p>
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
          {/* Work Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-1">
              Work Type
            </label>
            <select
              value={workType}
              onChange={(e) => handleWorkTypeChange(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl border border-stone-300 text-stone-900 text-base font-medium bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
            >
              {workTypes.map((wt, idx) => (
                <option key={wt.id || `${wt.name}-${idx}`} value={wt.name}>
                  {wt.name} ({wt.uom})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Auto-filled UOM */}
          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-1">
              Quantity
            </label>
            <div className="relative rounded-xl shadow-sm">
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full pl-3.5 pr-28 py-3 rounded-xl border border-stone-300 text-stone-900 text-base font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200">
                  {uom}
                </span>
              </div>
            </div>
          </div>

          {/* Status Segmented Toggle */}
          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-1.5">
              Work Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('Pending')}
                className={`py-3 px-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                  status === 'Pending'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pending</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('Done')}
                className={`py-3 px-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                  status === 'Done'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Done</span>
              </button>
            </div>
          </div>

          {/* Quick Helper toolbar */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Location / Chainage
            </span>
            <div className="flex items-center space-x-1.5">
              {lastDetectedGps && (
                <button
                  type="button"
                  onClick={() => {
                    setLocationFrom(lastDetectedGps.formattedLocation);
                    setLocationTo(lastDetectedGps.formattedLocation);
                  }}
                  className="text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 transition-colors flex items-center space-x-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Use Photo GPS</span>
                </button>
              )}
              {locationFrom && (
                <button
                  type="button"
                  onClick={() => setLocationTo(locationFrom)}
                  className="text-[10px] font-semibold bg-stone-100 text-stone-700 hover:bg-stone-200 px-2 py-0.5 rounded border border-stone-200 transition-colors flex items-center space-x-1"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>From ➔ To</span>
                </button>
              )}
            </div>
          </div>

          {/* Location From with GPS */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-stone-800">
                Location From <span className="text-stone-400 font-normal text-xs">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => handleCaptureGps('from')}
                disabled={gpsLoadingFrom}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 transition-colors"
              >
                {gpsLoadingFrom ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-amber-700" />
                )}
                <span>📍 Capture GPS</span>
              </button>
            </div>
            <input
              type="text"
              value={locationFrom}
              onChange={(e) => setLocationFrom(e.target.value)}
              placeholder="Optional: Auto-filled from photo GPS or live GPS"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Location To with GPS */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-stone-800">
                Location To <span className="text-stone-400 font-normal text-xs">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => handleCaptureGps('to')}
                disabled={gpsLoadingTo}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 transition-colors"
              >
                {gpsLoadingTo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-amber-700" />
                )}
                <span>📍 Capture GPS</span>
              </button>
            </div>
            <input
              type="text"
              value={locationTo}
              onChange={(e) => setLocationTo(e.target.value)}
              placeholder="Optional: Auto-filled from photo GPS or live GPS"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-1">
              Remark (Optional)
            </label>
            <textarea
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Photos Management with GPS Extraction */}
          <div>
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              maxPhotos={4}
              disabled={saving}
              onGpsExtracted={handleGpsExtracted}
              onPreviewPhoto={(idx) => setLightboxData({ index: idx })}
            />
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 font-bold text-white shadow-md disabled:opacity-50 transition-colors"
            >
              {saving ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Photo Lightbox */}
        {lightboxData && (
          <PhotoLightbox
            isOpen={Boolean(lightboxData)}
            photos={photos}
            initialIndex={lightboxData.index}
            title={`${workType} (${quantity} ${uom})`}
            onClose={() => setLightboxData(null)}
          />
        )}
      </div>
    </div>
  );
};

