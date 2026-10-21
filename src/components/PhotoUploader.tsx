import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, Eye, MapPin, Sparkles, UploadCloud } from 'lucide-react';
import { processFileList, ensureFirestoreSafePhotos } from '../utils/imageUtils';
import { extractGpsFromPhoto, PhotoGpsData } from '../utils/photoGpsExtractor';
import { GpsMapCameraModal } from './GpsMapCameraModal';

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  onPreviewPhoto?: (index: number) => void;
  onGpsExtracted?: (gpsData: PhotoGpsData, photoIndex: number) => void;
  disabled?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  onChange,
  maxPhotos = 4,
  onPreviewPhoto,
  onGpsExtracted,
  disabled = false,
}) => {
  const [compressing, setCompressing] = useState(false);
  const [extractingGps, setExtractingGps] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [gpsBadges, setGpsBadges] = useState<Record<number, PhotoGpsData>>({});
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [lastExtractedNotice, setLastExtractedNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    if (photos.length >= maxPhotos) return;

    setCompressing(true);
    setExtractingGps(true);

    try {
      const fileArray = Array.from(files).slice(0, maxPhotos - photos.length);
      const newImages = await processFileList(fileArray, photos.length, maxPhotos);

      if (newImages.length > 0) {
        const startIndex = photos.length;
        const combined = [...photos, ...newImages].slice(0, maxPhotos);
        const updatedPhotos = await ensureFirestoreSafePhotos(combined);
        onChange(updatedPhotos);

        // Run GPS detection on each new photo
        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];
          const photoIdx = startIndex + i;

          try {
            // First try with original file
            let gps = await extractGpsFromPhoto(file);
            // Fallback to data URL if file didn't yield
            if (!gps && newImages[i]) {
              gps = await extractGpsFromPhoto(newImages[i]);
            }

            if (gps) {
              setGpsBadges((prev) => ({ ...prev, [photoIdx]: gps! }));
              setLastExtractedNotice(`Detected GPS: ${gps.formattedCoords || gps.formattedLocation}`);
              if (onGpsExtracted) {
                onGpsExtracted(gps, photoIdx);
              }
            }
          } catch (gpsErr) {
            console.warn('GPS extraction notice:', gpsErr);
          }
        }
      }
    } catch (err) {
      console.error('Error processing photos:', err);
    } finally {
      setCompressing(false);
      setExtractingGps(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = async (data: {
    photoUrl: string;
    latitude: number;
    longitude: number;
    formattedCoords: string;
    locationAddress: string;
    cityOrArea: string;
    timestamp: string;
  }) => {
    if (photos.length >= maxPhotos) return;

    const newIndex = photos.length;
    const combined = [...photos, data.photoUrl].slice(0, maxPhotos);
    const updated = await ensureFirestoreSafePhotos(combined);
    onChange(updated);

    const gpsData: PhotoGpsData = {
      latitude: data.latitude,
      longitude: data.longitude,
      formattedCoords: data.formattedCoords,
      formattedLocation: data.locationAddress || data.cityOrArea,
      address: data.locationAddress,
      city: data.cityOrArea,
      timestamp: data.timestamp,
      source: 'both',
    };

    setGpsBadges((prev) => ({ ...prev, [newIndex]: gpsData }));
    setLastExtractedNotice(`Stamped Photo GPS: ${data.formattedCoords}`);

    if (onGpsExtracted) {
      onGpsExtracted(gpsData, newIndex);
    }
  };

  const handleRemove = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = photos.filter((_, i) => i !== index);
    const updatedBadges: { [key: number]: PhotoGpsData } = {};
    for (const key of Object.keys(gpsBadges)) {
      const idx = parseInt(key, 10);
      const data = gpsBadges[idx];
      if (data) {
        if (idx < index) {
          updatedBadges[idx] = data;
        } else if (idx > index) {
          updatedBadges[idx - 1] = data;
        }
      }
    }
    setGpsBadges(updatedBadges);
    onChange(updated);
  };

  const remaining = maxPhotos - photos.length;

  return (
    <div className="space-y-3">
      {/* Header with Photo Limits & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="block text-sm font-bold text-stone-900 flex items-center space-x-1.5">
          <Camera className="w-4 h-4 text-amber-600" />
          <span>Site Photos ({photos.length}/{maxPhotos})</span>
        </label>

        {/* 2 Clear Action Buttons: Click Photo & Upload Photo */}
        <div className="flex items-center space-x-2">
          {/* Click Photo Option (GPS Map Camera View) */}
          <button
            type="button"
            disabled={disabled || remaining <= 0}
            onClick={() => setIsCameraModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
            title="Click photo with live GPS Map Camera watermark"
          >
            <Camera className="w-4 h-4" />
            <span>Click Photo</span>
          </button>

          {/* Upload Photo Option (File / Gallery) */}
          <button
            type="button"
            disabled={disabled || remaining <= 0}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 font-bold text-xs border border-stone-300 transition-all disabled:opacity-50"
            title="Upload photo from phone gallery or files (auto-reads GPS)"
          >
            <UploadCloud className="w-4 h-4 text-stone-600" />
            <span>Upload Photo</span>
          </button>
        </div>
      </div>

      {/* Hidden File Input for Upload Option */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || remaining <= 0}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Extraction Status Alert */}
      {extractingGps && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2 text-xs font-semibold animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600 flex-shrink-0" />
          <span>Scanning uploaded photo for Lat & Long coordinates and address...</span>
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {photos.map((photo, idx) => (
          <div
            key={idx}
            onClick={() => onPreviewPhoto && onPreviewPhoto(idx)}
            className="group relative aspect-square rounded-xl overflow-hidden border-2 border-stone-200 bg-stone-100 cursor-pointer shadow-xs hover:border-amber-400 transition-all"
          >
            <img
              src={photo}
              alt={`Site work photo ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
            </div>

            {/* Photo Number Badge */}
            <span className="absolute bottom-1.5 left-1.5 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              #{idx + 1}
            </span>

            {/* GPS Detected Indicator Badge */}
            {gpsBadges[idx] && (
              <span
                title={`GPS Coordinates: ${gpsBadges[idx].formattedCoords || gpsBadges[idx].formattedLocation}`}
                className="absolute top-1.5 left-1.5 bg-emerald-700/90 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center space-x-0.5 shadow-xs border border-emerald-400/40"
              >
                <MapPin className="w-2.5 h-2.5 text-emerald-200" />
                <span>GPS</span>
              </span>
            )}

            {/* Delete button */}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => handleRemove(idx, e)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600/90 text-white hover:bg-rose-700 active:scale-95 shadow-md transition-transform"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Empty Slots */}
        {remaining > 0 && !disabled && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer select-none ${
              dragOver
                ? 'border-amber-500 bg-amber-50/80 scale-[1.02]'
                : 'border-stone-300 hover:border-amber-500 hover:bg-amber-50/50 bg-stone-50/60'
            }`}
          >
            {compressing || extractingGps ? (
              <div className="flex flex-col items-center space-y-1 text-amber-600">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-[11px] font-bold">Processing...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-1.5 w-full h-full">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="p-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-xs transition-transform"
                    title="Click Photo with GPS Map Camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-stone-200 text-stone-700 hover:bg-stone-300 active:scale-95 transition-transform"
                    title="Upload Stamped Image from Gallery"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] font-semibold text-stone-600">
                  <span>Click or Upload</span>
                  <div className="text-[10px] text-stone-400 font-normal">
                    {remaining} slot{remaining > 1 ? 's' : ''} left
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-stone-500">
        <span className="flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-600" />
          <span>Upload an image with GPS stamp or click photo to auto-fill Lat & Log and Location.</span>
        </span>
      </div>

      {/* GPS Map Camera Viewfinder Modal */}
      <GpsMapCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
