import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn } from 'lucide-react';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex = 0,
  isOpen,
  onClose,
  title = 'Site Work Photo',
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (!isOpen || !photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex] || photos[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = currentPhoto;
    link.download = `site-photo-${Date.now()}-${currentIndex + 1}.jpg`;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-sm p-4 text-white"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="w-full max-w-4xl flex items-center justify-between py-2 px-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h4 className="text-sm sm:text-base font-bold text-stone-100">{title}</h4>
          <p className="text-xs text-stone-400">
            Photo {currentIndex + 1} of {photos.length}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 active:bg-stone-600 text-stone-200 transition-colors"
            title="Download full photo"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 active:bg-stone-600 text-stone-200 transition-colors"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Area */}
      <div
        className="relative flex-1 w-full max-w-4xl flex items-center justify-center my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentPhoto}
          alt={`Site photo ${currentIndex + 1}`}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl transition-all"
        />

        {/* Prev / Next Navigation */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-white shadow-lg border border-stone-700 transition-transform active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-white shadow-lg border border-stone-700 transition-transform active:scale-95"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails list at bottom */}
      {photos.length > 1 && (
        <div
          className="flex items-center space-x-2 py-2 overflow-x-auto max-w-full z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                currentIndex === idx
                  ? 'border-amber-500 scale-105 opacity-100 shadow-md'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={photo} alt={`Thumb ${idx + 1}`} className="w-14 h-14 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
