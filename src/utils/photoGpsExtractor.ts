import exifr from 'exifr';
import { createWorker } from 'tesseract.js';

export interface PhotoGpsData {
  latitude: number;
  longitude: number;
  formattedLocation: string;
  source: 'exif' | 'ocr' | 'both';
  address?: string;
  timestamp?: string;
  confidence?: number;
}

/**
 * Parses GPS coordinates from text extracted via OCR
 */
export function parseGpsFromText(text: string): { latitude: number; longitude: number; address?: string; rawCoords?: string } | null {
  if (!text) return null;

  // Clean OCR text
  const clean = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');

  // Pattern 1: 18.9416N 73.0326E or 18.9416° N 73.0326° E or 18.9416 N, 73.0326 E
  const dmsRegex = /(\d{1,2}\.\d{3,8})\s*°?\s*([NSns])\s*[, ]+\s*(\d{1,3}\.\d{3,8})\s*°?\s*([EWew])/i;
  const dmsMatch = clean.match(dmsRegex);
  if (dmsMatch) {
    let lat = parseFloat(dmsMatch[1]);
    if (dmsMatch[2].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(dmsMatch[3]);
    if (dmsMatch[4].toUpperCase() === 'W') lng = -lng;

    // Try extracting address line (e.g. "W2RM+QCX, Jasai, Maharashtra 410206, India" or similar)
    const address = extractAddressFromOcr(clean);

    return {
      latitude: lat,
      longitude: lng,
      address,
      rawCoords: `${dmsMatch[1]}${dmsMatch[2].toUpperCase()} ${dmsMatch[3]}${dmsMatch[4].toUpperCase()}`,
    };
  }

  // Pattern 2: Lat: 18.9416, Lng: 73.0326 or Latitude: 18.9416 Longitude: 73.0326
  const labeledRegex = /(?:lat|latitude|latitud)[:\s]*([+-]?\d{1,2}\.\d{3,8})\s*[,; ]+\s*(?:long|longitude|lng|lon)[:\s]*([+-]?\d{1,3}\.\d{3,8})/i;
  const labeledMatch = clean.match(labeledRegex);
  if (labeledMatch) {
    const lat = parseFloat(labeledMatch[1]);
    const lng = parseFloat(labeledMatch[2]);
    const address = extractAddressFromOcr(clean);
    return {
      latitude: lat,
      longitude: lng,
      address,
      rawCoords: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }

  // Pattern 3: Standard decimal coordinates: 18.941600, 73.032600 or 18.9416 73.0326
  const decimalRegex = /\b([1-8]?\d\.\d{4,8})\s*[, ]\s*([0-1]?\d{1,2}\.\d{4,8})\b/;
  const decimalMatch = clean.match(decimalRegex);
  if (decimalMatch) {
    const lat = parseFloat(decimalMatch[1]);
    const lng = parseFloat(decimalMatch[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const address = extractAddressFromOcr(clean);
      return {
        latitude: lat,
        longitude: lng,
        address,
        rawCoords: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
  }

  return null;
}

/**
 * Extracts address or landmark text from GPS camera watermarks
 */
function extractAddressFromOcr(text: string): string | undefined {
  // Check for common Plus Codes like W2RM+QCX
  const plusCodeMatch = text.match(/([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}[,\s]+[^,\n]+(?:,\s*[^,\n]+){1,3})/i);
  if (plusCodeMatch) {
    return plusCodeMatch[0].trim();
  }

  // Look for city/state/pin pattern (e.g., Jasai, Maharashtra 410206, India)
  const placeMatch = text.match(/([A-Za-z0-9\s-]{3,30},\s*[A-Za-z\s]{3,20}\s*(?:\d{5,6})?(?:,\s*India|\s*USA)?)/i);
  if (placeMatch && !placeMatch[1].toLowerCase().includes('altitude') && !placeMatch[1].toLowerCase().includes('speed')) {
    return placeMatch[1].trim();
  }

  return undefined;
}

/**
 * Crops the bottom 35% and top 20% of an image where GPS stamps reside to speed up OCR and maximize accuracy
 */
async function cropGpsWatermarkArea(fileOrDataUrl: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : img.src);
      }

      // Crop the bottom 38% of the image (standard GPS Map Camera / Solocator area)
      const cropHeight = Math.round(img.height * 0.38);
      const cropY = img.height - cropHeight;

      canvas.width = img.width;
      canvas.height = cropHeight;

      // Draw bottom area
      ctx.drawImage(img, 0, cropY, img.width, cropHeight, 0, 0, img.width, cropHeight);

      // Boost contrast for OCR if needed
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => {
      resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Reverse geocode latitude and longitude to street/area name
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        const road = data.address?.road || data.address?.suburb || data.address?.neighbourhood || '';
        const city = data.address?.city || data.address?.town || data.address?.county || data.address?.state_district || '';
        if (road && city) {
          return `${road}, ${city}`;
        }
        return data.display_name.split(',').slice(0, 3).join(', ');
      }
    }
  } catch {
    // Offline or timeout
  }
  return '';
}

/**
 * Formats a clean Location string from coordinates and address
 */
export function formatLocationString(lat: number, lng: number, address?: string): string {
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
  const coordPart = `${latStr} ${lngStr}`;

  if (address && address.trim().length > 3) {
    return `${coordPart} - ${address.trim()}`;
  }
  return `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Main extractor: Combines EXIF metadata + OCR Watermark extraction
 */
export async function extractGpsFromPhoto(fileOrDataUrl: File | string): Promise<PhotoGpsData | null> {
  // 1. Try EXIF GPS metadata first (Fast & 100% accurate if present)
  try {
    const exifGps = await exifr.gps(fileOrDataUrl);
    if (exifGps && typeof exifGps.latitude === 'number' && typeof exifGps.longitude === 'number') {
      const { latitude, longitude } = exifGps;
      // Reverse geocode in background
      const address = await reverseGeocodeCoords(latitude, longitude);
      const formatted = formatLocationString(latitude, longitude, address);

      return {
        latitude,
        longitude,
        formattedLocation: formatted,
        source: 'exif',
        address,
      };
    }
  } catch (exifErr) {
    // Continue to OCR
  }

  // 2. OCR Watermark extraction (for GPS Map Camera / Timestamp Camera stamped images)
  try {
    const croppedImage = await cropGpsWatermarkArea(fileOrDataUrl);
    if (!croppedImage) return null;

    const worker = await createWorker('eng');
    const ret = await worker.recognize(croppedImage);
    await worker.terminate();

    const ocrText = ret.data.text;
    const parsed = parseGpsFromText(ocrText);

    if (parsed) {
      let finalAddress = parsed.address;
      if (!finalAddress) {
        finalAddress = await reverseGeocodeCoords(parsed.latitude, parsed.longitude);
      }

      const formatted = formatLocationString(parsed.latitude, parsed.longitude, finalAddress);

      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        formattedLocation: formatted,
        source: 'ocr',
        address: finalAddress,
        confidence: ret.data.confidence,
      };
    }

    // Also try full image if bottom crop didn't find coordinates (in case stamp is at top)
    const fullWorker = await createWorker('eng');
    const fullRet = await fullWorker.recognize(fileOrDataUrl);
    await fullWorker.terminate();

    const fullParsed = parseGpsFromText(fullRet.data.text);
    if (fullParsed) {
      let finalAddress = fullParsed.address;
      if (!finalAddress) {
        finalAddress = await reverseGeocodeCoords(fullParsed.latitude, fullParsed.longitude);
      }
      const formatted = formatLocationString(fullParsed.latitude, fullParsed.longitude, finalAddress);

      return {
        latitude: fullParsed.latitude,
        longitude: fullParsed.longitude,
        formattedLocation: formatted,
        source: 'ocr',
        address: finalAddress,
      };
    }
  } catch (ocrErr) {
    console.warn('OCR GPS extraction notice:', ocrErr);
  }

  return null;
}
