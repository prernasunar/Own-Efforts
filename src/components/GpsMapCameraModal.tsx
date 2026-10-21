import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RotateCcw, MapPin, Sparkles, AlertCircle, Check, Loader2 } from 'lucide-react';
import { reverseGeocodeCoords } from '../utils/photoGpsExtractor';

interface GpsMapCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (data: {
    photoUrl: string;
    latitude: number;
    longitude: number;
    formattedCoords: string;
    locationAddress: string;
    cityOrArea: string;
    timestamp: string;
  }) => void;
}

export const GpsMapCameraModal: React.FC<GpsMapCameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileFallbackInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // GPS & Location State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cityOrArea, setCityOrArea] = useState<string>('Navi Mumbai, Maharashtra, India');
  const [fullAddress, setFullAddress] = useState<string>('Detecting live site address...');
  const [countryFlag, setCountryFlag] = useState<string>('🇮🇳');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [capturing, setCapturing] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(true);

  // Live Clock Formatted as in attached image: "Thursday, 15/10/2026 06:49 PM GMT +05:30"
  const formatGpsTimestamp = (d: Date = new Date()): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[d.getDay()];

    const pad = (n: number) => n.toString().padStart(2, '0');
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();

    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 12 instead of 0
    const hh = pad(hours);

    // Timezone offset
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const offsetH = pad(Math.floor(Math.abs(offsetMin) / 60));
    const offsetM = pad(Math.abs(offsetMin) % 60);
    const gmtStr = `GMT ${sign}${offsetH}:${offsetM}`;

    return `${dayName}, ${dd}/${mm}/${yyyy} ${hh}:${minutes} ${ampm} ${gmtStr}`;
  };

  useEffect(() => {
    setCurrentTimeStr(formatGpsTimestamp());
    const timer = setInterval(() => {
      setCurrentTimeStr(formatGpsTimestamp());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Geolocation Watcher
  useEffect(() => {
    if (!isOpen) return;

    let watchId: number | null = null;
    setLocating(true);

    if ('geolocation' in navigator) {
      const handlePos = async (pos: GeolocationPosition) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setLocating(false);

        try {
          const rev = await reverseGeocodeCoords(latitude, longitude);
          if (rev) {
            setFullAddress(rev);
            const parts = rev.split(',').map((s) => s.trim());
            if (parts.length >= 2) {
              const lastTwo = parts.slice(-3).join(', ');
              setCityOrArea(lastTwo);
            }
          } else {
            setFullAddress(`Site Location (Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)})`);
          }
        } catch {
          setFullAddress(`Site Work Zone (Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)})`);
        }
      };

      const handleErr = (err: GeolocationPositionError) => {
        console.warn('Geolocation error:', err.message);
        // Fallback default coordinates if GPS unavailable (Navi Mumbai default matching sample)
        setCoords({ lat: 19.053155, lng: 73.016608 });
        setCityOrArea('Navi Mumbai, Maharashtra, India');
        setFullAddress('Anirudha Bhawan, Sector 23, Juinagar, Navi Mumbai, Maharashtra 400706, India');
        setLocating(false);
      };

      navigator.geolocation.getCurrentPosition(handlePos, handleErr, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });

      watchId = navigator.geolocation.watchPosition(handlePos, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 10000,
      });
    } else {
      setCoords({ lat: 19.053155, lng: 73.016608 });
      setLocating(false);
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen]);

  // Start Camera Stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      setCameraActive(false);
      setCameraError('Camera access unavailable or permission denied. You can select an image from gallery or file picker.');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode, startCamera]);

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Draw the GPS Map Camera Watermark onto an image canvas
  const drawGpsMapCameraWatermark = async (
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    lat: number,
    lng: number,
    addressText: string,
    cityText: string,
    timestampText: string
  ) => {
    // Height of watermark banner card: ~22% of image height (minimum 180px, max 320px)
    const cardH = Math.max(180, Math.min(Math.round(canvasH * 0.24), 320));
    const cardMargin = Math.round(canvasW * 0.03);
    const cardW = canvasW - cardMargin * 2;
    const cardX = cardMargin;
    const cardY = canvasH - cardH - cardMargin;
    const cardRadius = 18;

    ctx.save();

    // 1. Drop shadow for the card
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // 2. Card background (Dark translucent rounded box)
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fillStyle = 'rgba(18, 22, 28, 0.88)';
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // 3. Subtle inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. "GPS Map Camera" Badge at Top-Right of Card
    const badgeText = '📷 GPS Map Camera';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    const badgeMetrics = ctx.measureText(badgeText);
    const badgeW = badgeMetrics.width + 16;
    const badgeH = 22;
    const badgeX = cardX + cardW - badgeW - 14;
    const badgeY = cardY + 12;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + 8, badgeY + badgeH / 2);

    // 5. Inset Map Box on Left Side of Card
    const mapPadding = 12;
    const mapSize = cardH - mapPadding * 2;
    const mapX = cardX + mapPadding;
    const mapY = cardY + mapPadding;

    // Draw Map background & grid / satellite simulation
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapSize, mapSize, 12);
    ctx.clip();

    // Fill with satellite-like dark earth tones
    const mapGrad = ctx.createLinearGradient(mapX, mapY, mapX + mapSize, mapY + mapSize);
    mapGrad.addColorStop(0, '#2d3748');
    mapGrad.addColorStop(0.5, '#1a202c');
    mapGrad.addColorStop(1, '#3b4759');
    ctx.fillStyle = mapGrad;
    ctx.fillRect(mapX, mapY, mapSize, mapSize);

    // Road grid lines on map
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mapX + mapSize * 0.2, mapY);
    ctx.lineTo(mapX + mapSize * 0.35, mapY + mapSize);
    ctx.moveTo(mapX, mapY + mapSize * 0.6);
    ctx.lineTo(mapX + mapSize, mapY + mapSize * 0.5);
    ctx.moveTo(mapX + mapSize * 0.7, mapY);
    ctx.lineTo(mapX + mapSize * 0.6, mapY + mapSize);
    ctx.stroke();

    // Red Location Pin in Map center
    const pinX = mapX + mapSize / 2;
    const pinY = mapY + mapSize / 2;

    // Pin shadow
    ctx.beginPath();
    ctx.ellipse(pinX, pinY + 6, 7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // Pin head & needle
    ctx.beginPath();
    ctx.arc(pinX, pinY - 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ea4335'; // Google Maps Red
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pinX - 7, pinY - 6);
    ctx.lineTo(pinX + 7, pinY - 6);
    ctx.lineTo(pinX, pinY + 4);
    ctx.closePath();
    ctx.fillStyle = '#ea4335';
    ctx.fill();

    // White dot inside pin
    ctx.beginPath();
    ctx.arc(pinX, pinY - 8, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Google Logo watermark in bottom-left of map
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Google', mapX + 8, mapY + mapSize - 8);

    ctx.restore();

    // 6. Right Side Text Details
    const textStartX = mapX + mapSize + 16;
    const maxTextW = cardX + cardW - textStartX - 14;
    let currentY = cardY + 24;

    // Line 1: City / State / Country (Bold White, 17px)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(cityText, textStartX, currentY);
    currentY += 24;

    // Line 2: Country Flag
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('🇮🇳', textStartX, currentY);
    currentY += 22;

    // Line 3: Full Detailed Address (Clean White, 12px, wrap if necessary)
    ctx.font = '500 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f1f5f9';

    // Simple word wrapping for address
    const words = addressText.split(' ');
    let line = '';
    let addressLinesDrawn = 0;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextW && n > 0) {
        ctx.fillText(line, textStartX, currentY);
        line = words[n] + ' ';
        currentY += 16;
        addressLinesDrawn++;
        if (addressLinesDrawn >= 2) break; // Max 2 lines for address
      } else {
        line = testLine;
      }
    }
    if (addressLinesDrawn < 2 && line.trim()) {
      ctx.fillText(line, textStartX, currentY);
      currentY += 18;
    } else {
      currentY += 6;
    }

    // Line 4: Lat / Long Coordinates: "Lat 19.053155° Long 73.016608°" (Bold Yellow/White)
    ctx.fillStyle = '#fde047'; // Bright yellow for clear visibility
    ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, monospace';
    const coordsStr = `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`;
    ctx.fillText(coordsStr, textStartX, currentY);
    currentY += 19;

    // Line 5: Timestamp string: "Thursday, 15/10/2026 06:49 PM GMT +05:30"
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11.5px system-ui, -apple-system, BlinkMacSystemFont, monospace';
    ctx.fillText(timestampText, textStartX, currentY);

    ctx.restore();
  };

  // Capture Frame and Composite Stamped Image
  const handleCapture = async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const rawW = video.videoWidth || 1280;
      const rawH = video.videoHeight || 720;
      const maxDim = 960;
      const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
      const targetW = Math.round(rawW * scale);
      const targetH = Math.round(rawH * scale);

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      // 1. Draw camera video frame
      ctx.drawImage(video, 0, 0, targetW, targetH);

      // 2. Draw GPS Map Camera watermark banner
      const lat = coords?.lat ?? 19.053155;
      const lng = coords?.lng ?? 73.016608;
      const formattedCoords = `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`;
      const timeStr = currentTimeStr || formatGpsTimestamp();

      await drawGpsMapCameraWatermark(ctx, targetW, targetH, lat, lng, fullAddress, cityOrArea, timeStr);

      // 3. Compress to Firestore-safe JPEG data URL
      const photoUrl = canvas.toDataURL('image/jpeg', 0.72);

      onCapture({
        photoUrl,
        latitude: lat,
        longitude: lng,
        formattedCoords,
        locationAddress: fullAddress,
        cityOrArea,
        timestamp: timeStr,
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to capture photo:', err);
    } finally {
      setCapturing(false);
    }
  };

  // Fallback: If user selects photo from file input when camera unavailable
  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCapturing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width || 960, img.height || 720));
        const targetW = Math.round(img.width * scale);
        const targetH = Math.round(img.height * scale);
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const lat = coords?.lat ?? 19.053155;
          const lng = coords?.lng ?? 73.016608;
          const formattedCoords = `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`;
          const timeStr = currentTimeStr || formatGpsTimestamp();

          await drawGpsMapCameraWatermark(ctx, targetW, targetH, lat, lng, fullAddress, cityOrArea, timeStr);
          const photoUrl = canvas.toDataURL('image/jpeg', 0.72);

          onCapture({
            photoUrl,
            latitude: lat,
            longitude: lng,
            formattedCoords,
            locationAddress: fullAddress,
            cityOrArea,
            timestamp: timeStr,
          });
          onClose();
        }
        setCapturing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const latDisplay = coords ? coords.lat.toFixed(6) : '19.053155';
  const lngDisplay = coords ? coords.lng.toFixed(6) : '73.016608';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-4 backdrop-blur-md">
      <div className="relative w-full h-full max-w-lg sm:max-h-[92dvh] bg-stone-950 sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl border border-stone-800">
        {/* Top Header Controls */}
        <div className="absolute top-0 inset-x-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white text-xs font-black tracking-wide uppercase drop-shadow-md">
              GPS Map Camera
            </span>
            {locating && (
              <span className="text-[10px] bg-amber-500/80 text-white font-bold px-2 py-0.5 rounded-full">
                Locating...
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleFacingMode}
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border border-white/20 active:scale-95 transition-all"
              title="Flip Camera"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border border-white/20 active:scale-95 transition-all"
              title="Close Camera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder or Fallback */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-4 max-w-sm">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-stone-300">{cameraError}</p>
              <input
                ref={fileFallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFallbackFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileFallbackInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm shadow-md transition-colors"
              >
                📸 Take Photo / Pick from Gallery
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {/* EXACT GPS Map Camera Viewfinder Overlay at bottom of stream */}
          <div className="absolute bottom-24 inset-x-3 pointer-events-none">
            <div className="bg-stone-900/90 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-white shadow-2xl space-y-2">
              {/* Badge on top right */}
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Civil Site Live Stamp</span>
                </span>
                <span className="text-[10px] font-black bg-white text-stone-900 px-2 py-0.5 rounded shadow-xs flex items-center space-x-1">
                  <Camera className="w-3 h-3 text-stone-900" />
                  <span>GPS Map Camera</span>
                </span>
              </div>

              {/* Main Info Columns */}
              <div className="flex items-start space-x-3">
                {/* Mini Map simulation with red pin */}
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-stone-800 border border-white/20 flex-shrink-0 flex items-center justify-center shadow-inner">
                  {/* Map grid lines */}
                  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]" />
                  <div className="relative flex flex-col items-center">
                    <span className="text-xl drop-shadow-md">📍</span>
                    <span className="text-[9px] font-black text-white/90 bg-black/60 px-1 rounded mt-0.5">
                      Google
                    </span>
                  </div>
                </div>

                {/* Text lines */}
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm text-white truncate block">
                      {cityOrArea}
                    </span>
                    <span className="text-xs">{countryFlag}</span>
                  </div>
                  <p className="text-[11px] font-medium text-stone-300 line-clamp-2 leading-tight">
                    {fullAddress}
                  </p>
                  <p className="text-xs font-black text-yellow-300 font-mono tracking-tight">
                    Lat {latDisplay}° Long {lngDisplay}°
                  </p>
                  <p className="text-[10px] text-stone-400 font-mono">
                    {currentTimeStr}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Shutter Capture Bar */}
        <div
          className="p-4 sm:p-5 bg-stone-950 flex items-center justify-around z-20 border-t border-stone-900"
          style={{ paddingBottom: 'calc(1rem + var(--sab))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white text-xs font-bold px-3 py-2 transition-colors"
          >
            Cancel
          </button>

          {/* Big White Camera Shutter Button */}
          <button
            type="button"
            disabled={capturing || cameraError !== null}
            onClick={handleCapture}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center p-1.5 shadow-xl disabled:opacity-50"
            title="Capture Stamped GPS Photo"
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-md">
              {capturing ? (
                <Loader2 className="w-6 h-6 animate-spin text-stone-900" />
              ) : (
                <Camera className="w-6 h-6 text-stone-900" />
              )}
            </div>
          </button>

          {/* Gallery fallback */}
          <button
            type="button"
            onClick={() => fileFallbackInputRef.current?.click()}
            className="text-amber-400 hover:text-amber-300 text-xs font-bold px-3 py-2 transition-colors"
          >
            Gallery
          </button>
        </div>
      </div>
    </div>
  );
};
