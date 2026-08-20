import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkData } from '../context/WorkDataContext';
import { WorkEntry, EntryStatus, UOMType } from '../types';
import {
  Plus,
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
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { captureCurrentLocation } from '../utils/geo';
import { formatSingleEntryText } from '../utils/share';
import { AddWorkTypeModal } from './AddWorkTypeModal';
import { EditEntryModal } from './EditEntryModal';
import { ShareModal } from './ShareModal';
import { PhotoUploader } from './PhotoUploader';
import { PhotoLightbox } from './PhotoLightbox';
import { Camera, Image as ImageIcon } from 'lucide-react';

export const FieldWorkerDashboard: React.FC = () => {
  const { userProfile, user } = useAuth();
  const { workTypes, myEntries, createEntry, updateEntry, deleteEntry, addWorkType, loading } =
    useWorkData();

  // Form State
  const [selectedWorkType, setSelectedWorkType] = useState<string>('T&D');
  const [uom, setUom] = useState<UOMType>('meter');
  const [quantity, setQuantity] = useState<string>('');
  const [status, setStatus] = useState<EntryStatus>('Done');
  const [locationFrom, setLocationFrom] = useState<string>('');
  const [locationTo, setLocationTo] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [gpsLoadingFrom, setGpsLoadingFrom] = useState<boolean>(false);
  const [gpsLoadingTo, setGpsLoadingTo] = useState<boolean>(false);

  // Modals & Lightbox state
  const [isAddTypeOpen, setIsAddTypeOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{ title: string; text: string; photos?: string[] } | null>(null);
  const [lightboxData, setLightboxData] = useState<{ photos: string[]; index: number; title: string } | null>(null);

  // Sync UOM when work type changes
  useEffect(() => {
    const matched = workTypes.find((wt) => wt.name === selectedWorkType);
    if (matched) {
      setUom(matched.uom);
    } else if (workTypes.length > 0) {
      setSelectedWorkType(workTypes[0].name);
      setUom(workTypes[0].uom);
    }
  }, [selectedWorkType, workTypes]);

  const handleSelectWorkType = (val: string) => {
    if (val === '__ADD_NEW__') {
      setIsAddTypeOpen(true);
    } else {
      setSelectedWorkType(val);
      const matched = workTypes.find((wt) => wt.name === val);
      if (matched) {
        setUom(matched.uom);
      }
    }
  };

  const handleCaptureGPS = async (field: 'from' | 'to') => {
    setFormError(null);
    if (field === 'from') setGpsLoadingFrom(true);
    else setGpsLoadingTo(true);

    try {
      const geo = await captureCurrentLocation();
      if (field === 'from') {
        setLocationFrom(geo.formattedAddress);
      } else {
        setLocationTo(geo.formattedAddress);
      }
    } catch (err: any) {
      setFormError(err.message || 'GPS location capture failed. You may enter text manually.');
    } finally {
      if (field === 'from') setGpsLoadingFrom(false);
      else setGpsLoadingTo(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setFormError('Please enter a valid positive quantity.');
      return;
    }
    if (!locationFrom.trim()) {
      setFormError('Please specify "Location From" (use GPS or manual text).');
      return;
    }
    if (!locationTo.trim()) {
      setFormError('Please specify "Location To" (use GPS or manual text).');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      await createEntry({
        workType: selectedWorkType,
        uom,
        quantity: qtyNum,
        status,
        locationFrom: locationFrom.trim(),
        locationTo: locationTo.trim(),
        remark: remark.trim(),
        photos,
      });

      setFormSuccess(true);
      // Reset form fields except locations for quick repetitive logging
      setQuantity('');
      setRemark('');
      setPhotos([]);
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit site work log.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      await deleteEntry(id);
      setDeletingId(null);
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleShareEntry = (entry: WorkEntry) => {
    const text = formatSingleEntryText(entry);
    setShareData({
      title: `Share Log: ${entry.workType}`,
      text,
      photos: entry.photos || [],
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8 font-sans">
      {/* Worker Greeting & Auto-Captured Details */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-700/80 text-[11px] font-bold uppercase tracking-wider mb-1">
            👷 Active Field Worker
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {userProfile?.name || user?.displayName || 'Site Engineer'}
          </h2>
          <p className="text-xs text-amber-100 mt-0.5">
            Auto-stamped with your authenticated ID & live timestamp on every submit.
          </p>
        </div>

        <div className="bg-amber-700/60 border border-amber-300/30 rounded-xl px-3.5 py-2 text-right self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
          <span className="text-[11px] font-medium text-amber-200">Logged Today</span>
          <span className="text-lg font-black text-white">{myEntries.length} entries</span>
        </div>
      </div>

      {/* CORE FEATURE: DAILY WORK ENTRY LOG FORM */}
      <section className="bg-white rounded-2xl p-5 sm:p-7 shadow-md border border-stone-200">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-stone-900 tracking-tight">
                Daily Work Entry Log
              </h3>
              <p className="text-xs text-stone-500">Record civil work items with GPS & quantities</p>
            </div>
          </div>
        </div>

        {formSuccess && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center space-x-3 shadow-xs">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Site Log Submitted Successfully!</p>
              <p className="text-xs text-emerald-700">
                Synced to cloud and visible on the manager dashboard in real time.
              </p>
            </div>
          </div>
        )}

        {formError && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">{formError}</p>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* 1. Work Type & Auto-filled UOM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-stone-900">
                  Work Type <span className="text-amber-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddTypeOpen(true)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add new work type</span>
                </button>
              </div>

              <select
                value={selectedWorkType}
                onChange={(e) => handleSelectWorkType(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-stone-300 text-stone-900 text-base font-semibold bg-white focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors shadow-xs"
              >
                {workTypes.map((wt, index) => (
                  <option key={wt.id || `type-${index}`} value={wt.name}>
                    {wt.name} {wt.isCustom ? '(Custom)' : ''}
                  </option>
                ))}
                <option value="__ADD_NEW__" className="font-bold text-amber-700">
                  ➕ + Add new custom work type...
                </option>
              </select>
            </div>

            {/* Locked UOM Display */}
            <div>
              <label className="block text-sm font-bold text-stone-900 mb-1.5">
                Unit of Measurement
              </label>
              <div className="w-full px-4 py-3.5 rounded-xl bg-stone-100 border-2 border-stone-200 text-stone-800 font-bold text-base flex items-center justify-between shadow-inner">
                <span>{uom}</span>
                <span className="text-[11px] font-semibold text-stone-500 uppercase px-2 py-0.5 rounded bg-stone-200">
                  Locked
                </span>
              </div>
            </div>
          </div>

          {/* 2. Quantity Input */}
          <div>
            <label className="block text-sm font-bold text-stone-900 mb-1.5">
              Quantity ({uom}) <span className="text-amber-600">*</span>
            </label>
            <div className="relative rounded-xl shadow-xs">
              <input
                type="number"
                step="any"
                required
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Enter quantity in ${uom}`}
                className="w-full pl-4 pr-24 py-3.5 rounded-xl border-2 border-stone-300 text-stone-900 text-lg font-bold placeholder-stone-400 focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-black uppercase">
                  {uom}
                </span>
              </div>
            </div>
          </div>

          {/* 3. GPS Location (From -> To) */}
          <div className="space-y-4 pt-1">
            {/* Location From */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-stone-900">
                  Location From <span className="text-amber-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleCaptureGPS('from')}
                  disabled={gpsLoadingFrom}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-100 text-amber-900 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-xs"
                >
                  {gpsLoadingFrom ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
                  ) : (
                    <MapPin className="w-4 h-4 text-amber-700" />
                  )}
                  <span>📍 Capture GPS</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={locationFrom}
                onChange={(e) => setLocationFrom(e.target.value)}
                placeholder="e.g. MH-104 / Substation Gate or capture via GPS"
                className="w-full px-4 py-3 rounded-xl border-2 border-stone-300 text-stone-900 text-sm font-medium focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
              />
            </div>

            {/* Location To */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-stone-900">
                  Location To <span className="text-amber-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleCaptureGPS('to')}
                  disabled={gpsLoadingTo}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-100 text-amber-900 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-xs"
                >
                  {gpsLoadingTo ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
                  ) : (
                    <MapPin className="w-4 h-4 text-amber-700" />
                  )}
                  <span>📍 Capture GPS</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={locationTo}
                onChange={(e) => setLocationTo(e.target.value)}
                placeholder="e.g. MH-105 / Pole #42 or capture via GPS"
                className="w-full px-4 py-3 rounded-xl border-2 border-stone-300 text-stone-900 text-sm font-medium focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 4. Status Segmented Toggle */}
          <div>
            <label className="block text-sm font-bold text-stone-900 mb-1.5">
              Work Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('Pending')}
                className={`py-3.5 px-4 rounded-xl border-2 font-black text-sm sm:text-base flex items-center justify-center space-x-2 transition-all shadow-xs ${
                  status === 'Pending'
                    ? 'border-orange-500 bg-orange-50 text-orange-950 ring-2 ring-orange-400/40'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Clock
                  className={`w-5 h-5 ${
                    status === 'Pending' ? 'text-orange-600' : 'text-stone-400'
                  }`}
                />
                <span>⏳ Pending</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('Done')}
                className={`py-3.5 px-4 rounded-xl border-2 font-black text-sm sm:text-base flex items-center justify-center space-x-2 transition-all shadow-xs ${
                  status === 'Done'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-400/40'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CheckCircle2
                  className={`w-5 h-5 ${
                    status === 'Done' ? 'text-emerald-600' : 'text-stone-400'
                  }`}
                />
                <span>✅ Done</span>
              </button>
            </div>
          </div>

          {/* 5. Optional Remark */}
          <div>
            <label className="block text-sm font-bold text-stone-900 mb-1.5">
              Remark / Site Notes <span className="text-xs font-normal text-stone-500">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Duct joined with coupler, caution tape installed, soil backfilled..."
              className="w-full px-4 py-3 rounded-xl border-2 border-stone-300 text-stone-900 text-sm font-medium focus:border-amber-600 focus:ring-0 focus:outline-none transition-colors"
            />
          </div>

          {/* 6. Site Photos (Up to 4) */}
          <div className="pt-1">
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              maxPhotos={4}
              disabled={submitting}
              onPreviewPhoto={(idx) =>
                setLightboxData({
                  photos,
                  index: idx,
                  title: `${selectedWorkType} - Photo #${idx + 1}`,
                })
              }
            />
          </div>

          {/* Big Tap Primary Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black text-lg shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-amber-400/50 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Logging Site Work...</span>
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

      {/* FIELD WORKER — MY ENTRIES LIST */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              My Past Site Logs
            </h3>
            <p className="text-xs font-medium text-stone-500">
              Only your submitted entries ({myEntries.length})
            </p>
          </div>
        </div>

        {myEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-stone-200">
            <p className="font-bold text-stone-700 text-base">No work logs submitted yet.</p>
            <p className="text-xs text-stone-500 mt-1">
              Use the form above to log your first civil work item today.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {myEntries.map((entry) => {
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
                  className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-200 hover:border-amber-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-base sm:text-lg font-black text-stone-900">
                          {entry.workType}
                        </h4>
                        {/* Status badge: Orange for Pending, Green for Done */}
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-orange-100 text-orange-800 border-orange-300'
                          }`}
                        >
                          {isDone ? '✅ Done' : '⏳ Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">Logged: {formattedDate}</p>
                    </div>

                    {/* Big Quantity Pill */}
                    <div className="bg-stone-100 border border-stone-300 rounded-xl px-3 py-1.5 text-right flex-shrink-0">
                      <span className="block text-base sm:text-lg font-black text-stone-900 leading-tight">
                        {entry.quantity}
                      </span>
                      <span className="text-[10px] font-bold text-stone-500 uppercase">{entry.uom}</span>
                    </div>
                  </div>

                  {/* Locations From -> To */}
                  <div className="bg-stone-50 rounded-xl p-3 text-xs space-y-1.5 border border-stone-200/80 mb-3">
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-stone-600 flex-shrink-0">📍 From:</span>
                      <span className="text-stone-900 font-medium break-words">
                        {entry.locationFrom}
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-stone-600 flex-shrink-0">📍 To:</span>
                      <span className="text-stone-900 font-medium break-words">
                        {entry.locationTo}
                      </span>
                    </div>
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
                            <span>Attached Site Photos ({entry.photos.length})</span>
                          </span>
                          <span className="text-[10px] text-stone-400 font-semibold">Tap to enlarge</span>
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
                                  title: `${entry.workType} (${entry.quantity} ${entry.uom})`,
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

                  {/* Actions: Edit, Delete, Share */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingEntry(entry)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingId(entry.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleShareEntry(entry)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 transition-colors shadow-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Custom Work Type Modal */}
      <AddWorkTypeModal
        isOpen={isAddTypeOpen}
        onClose={() => setIsAddTypeOpen(false)}
        onAdd={async (name, newUom) => {
          await addWorkType(name, newUom);
          setSelectedWorkType(name);
          setUom(newUom);
        }}
      />

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
