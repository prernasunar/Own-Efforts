import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Copy,
  Check,
  Share2,
  Camera,
  Download,
  ExternalLink,
  Smartphone,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { getWhatsAppUrl, getTelegramUrl } from '../utils/share';
import {
  downloadPhoto,
  downloadAllPhotos,
  copyPhotoToClipboard,
  shareWithNativeFiles,
} from '../utils/imageUtils';
import { PhotoLightbox } from './PhotoLightbox';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  shareText: string;
  photos?: string[];
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  shareText,
  photos = [],
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedPhotoIdx, setCopiedPhotoIdx] = useState<number | null>(null);
  const [downloadedAll, setDownloadedAll] = useState(false);
  const [nativeShareLoading, setNativeShareLoading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopyText = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleCopyPhoto = async (photo: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyPhotoToClipboard(photo);
    if (ok) {
      setCopiedPhotoIdx(idx);
      setTimeout(() => setCopiedPhotoIdx(null), 2500);
    } else {
      // Fallback: download photo
      downloadPhoto(photo, `site-photo-${idx + 1}.jpg`);
    }
  };

  const handleDownloadSingle = (photo: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadPhoto(photo, `site-photo-${idx + 1}.jpg`);
  };

  const handleDownloadAll = () => {
    if (photos.length === 0) return;
    downloadAllPhotos(photos, 'site-work');
    setDownloadedAll(true);
    setTimeout(() => setDownloadedAll(false), 3000);
  };

  const handleNativeShare = async () => {
    setNativeShareLoading(true);
    try {
      await shareWithNativeFiles(title, shareText, photos);
    } finally {
      setNativeShareLoading(false);
    }
  };

  const whatsappUrl = getWhatsAppUrl(shareText);
  const telegramUrl = getTelegramUrl(shareText);
  const hasPhotos = photos && photos.length > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-stone-200 my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3.5 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-stone-500">
                  {hasPhotos
                    ? `${photos.length} photo${photos.length > 1 ? 's' : ''} + formatted log ready to share`
                    : 'Share work log via chat apps'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto pr-1 space-y-4 flex-1">
            {/* 1. Attached Photos Gallery (if present) */}
            {hasPhotos && (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-700">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span>Attached Site Photos ({photos.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-stone-700 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-300 rounded-lg transition-colors shadow-2xs"
                  >
                    {downloadedAll ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Photos Saved!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-stone-600" />
                        <span>Save All Photos</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Thumbnail Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setLightboxIdx(idx)}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-stone-300 bg-stone-200 cursor-pointer hover:border-amber-500 transition-all shadow-2xs"
                    >
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>

                      {/* Photo Index */}
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                        #{idx + 1}
                      </span>

                      {/* Action buttons on thumbnail */}
                      <div className="absolute top-1 right-1 flex space-x-1">
                        <button
                          type="button"
                          onClick={(e) => handleDownloadSingle(photo, idx, e)}
                          className="p-1 rounded bg-stone-900/80 hover:bg-stone-900 text-white text-[10px] shadow transition-transform active:scale-95"
                          title="Save this photo"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCopyPhoto(photo, idx, e)}
                          className="p-1 rounded bg-stone-900/80 hover:bg-stone-900 text-white text-[10px] shadow transition-transform active:scale-95"
                          title="Copy image to clipboard"
                        >
                          {copiedPhotoIdx === idx ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Primary 1-Tap Share Option (Native Device Share with Files) */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                  <Smartphone className="w-4 h-4 text-amber-700" />
                  <span>
                    {hasPhotos ? '1-Tap Share: Log + Photos Together' : '1-Tap Device Share'}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-amber-800 mb-3">
                {hasPhotos
                  ? 'Natively attaches both the photos and the formatted text log directly into WhatsApp, Telegram, or your preferred messaging app.'
                  : 'Sends formatted site report directly to any app installed on your device.'}
              </p>
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={nativeShareLoading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>
                  {hasPhotos
                    ? `Share Log with ${photos.length} Photo${photos.length > 1 ? 's' : ''}`
                    : 'Share to WhatsApp / Apps'}
                </span>
              </button>
            </div>

            {/* 3. Direct WhatsApp & Telegram Web / Quick Links */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                Direct App Links
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors text-center"
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">WhatsApp</span>
                </a>

                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors text-center"
                >
                  <Send className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Telegram</span>
                </a>
              </div>
            </div>

            {/* 4. Formatted Text Preview & Copy */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                  Formatted Text
                </label>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-amber-700 hover:text-amber-800"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                {shareText}
              </div>
            </div>
          </div>

          {/* Footer Close */}
          <div className="pt-3 border-t border-stone-200 mt-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl border border-stone-300 font-bold text-xs sm:text-sm text-stone-700 hover:bg-stone-100 transition-colors text-center"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox when clicking thumbnail in share dialog */}
      {lightboxIdx !== null && (
        <PhotoLightbox
          isOpen={lightboxIdx !== null}
          photos={photos}
          initialIndex={lightboxIdx}
          title={title}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
};

