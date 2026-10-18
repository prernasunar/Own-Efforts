import exifr from 'exifr';
import { createWorker } from 'tesseract.js';

export interface PhotoGpsData {
  latitude: number;
  longitude: number;
  formattedLocation: string;
  formattedCoords?: string; // e.g. "Lat 19.053155° Long 73.016608°"
  source: 'gemini' | 'exif' | 'ocr' | 'both';
  address?: string;
  city?: string;
  timestamp?: string;
  confidence?: number;
}

/**
 * Parses GPS coordinates from text extracted via OCR or watermark scanning
 */
export function parseGpsFromText(text: string): { latitude: number; longitude: number; address?: string; rawCoords?: string } | null {
  if (!text) return null;

  // Clean OCR text: replace line breaks with spaces, normalize degree signs
  const clean = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[°ºoO]/g, '°')
    .replace(/\s+/g, ' ');

  // Pattern 1: Lat 19.053155° Long 73.016608° or Lat: 19.053155° Long: 73.016608° (GPS Map Camera format!)
  const gpsCameraRegex = /(?:lat|latitude|latitud)[:\s]*([+-]?\d{1,2}\.\d{3,8})\s*°?\s*([NSns])?[\s,;|-]+(?:long|longitude|lng|lon)[:\s]*([+-]?\d{1,3}\.\d{3,8})\s*°?\s*([EWew])?/i;
  const gpsCameraMatch = clean.match(gpsCameraRegex);
  if (gpsCameraMatch) {
    let lat = parseFloat(gpsCameraMatch[1]);
    if (gpsCameraMatch[2] && gpsCameraMatch[2].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(gpsCameraMatch[3]);
    if (gpsCameraMatch[4] && gpsCameraMatch[4].toUpperCase() === 'W') lng = -lng;

    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const address = extractAddressFromOcr(clean);
      return {
        latitude: lat,
        longitude: lng,
        address,
        rawCoords: `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`,
      };
    }
  }

  // Pattern 2: 18.9416N 73.0326E or 18.9416° N 73.0326° E or 18.9416 N, 73.0326 E
  const dmsRegex = /(\d{1,2}\.\d{3,8})\s*°?\s*([NSns])\s*[, ]+\s*(\d{1,3}\.\d{3,8})\s*°?\s*([EWew])/i;
  const dmsMatch = clean.match(dmsRegex);
  if (dmsMatch) {
    let lat = parseFloat(dmsMatch[1]);
    if (dmsMatch[2].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(dmsMatch[3]);
    if (dmsMatch[4].toUpperCase() === 'W') lng = -lng;

    const address = extractAddressFromOcr(clean);
    return {
      latitude: lat,
      longitude: lng,
      address,
      rawCoords: `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`,
    };
  }

  // Pattern 3: Standard decimal coordinates: 18.941600, 73.032600 or 18.9416 73.0326
  const decimalRegex = /\b([1-8]?\d\.\d{4,8})\s*°?\s*[, ]\s*([0-1]?\d{1,2}\.\d{4,8})\s*°?\b/;
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
        rawCoords: `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`,
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

  // Look for city/state/pin pattern (e.g., Anirudha Bhawan, Sector 23, Juinagar, Navi Mumbai, Maharashtra 400706, India)
  const placeMatch = text.match(/([A-Za-z0-9\s-]{4,40},\s*[A-Za-z0-9\s-]{3,30},\s*[A-Za-z\s]{3,25}(?:,\s*[A-Za-z\s]{3,20})?\s*(?:\d{5,6})?(?:,\s*India|\s*USA)?)/i);
  if (placeMatch && !placeMatch[1].toLowerCase().includes('altitude') && !placeMatch[1].toLowerCase().includes('speed')) {
    return placeMatch[1].trim();
  }

  return undefined;
}

/**
 * Helper to convert File to Base64 string
 */
async function fileToBase64(fileOrDataUrl: File | string): Promise<string> {
  if (typeof fileOrDataUrl === 'string') return fileOrDataUrl;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(fileOrDataUrl);
  });
}

/**
 * Crops the bottom 38% of an image where GPS Map Camera stamps reside to optimize OCR
 */
async function cropGpsWatermarkArea(fileOrDataUrl: File | string): Promise<string> {
  return new Promise((resolve) => {
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
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Reverse geocode latitude and longitude to street/area name using OpenStreetMap
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
    // Offline or network timeout
  }
  return '';
}

/**
 * Formats a clean Location string from coordinates and address
 */
export function formatLocationString(lat: number, lng: number, address?: string): string {
  const coordStr = `Lat ${lat.toFixed(6)}° Long ${lng.toFixed(6)}°`;
  if (address && address.trim().length > 3) {
    return `${address.trim()} (${coordStr})`;
  }
  return coordStr;
}

/**
 * Main extractor: Combines Server-side Gemini AI + EXIF metadata + Client-side OCR
 */
export async function extractGpsFromPhoto(fileOrDataUrl: File | string): Promise<PhotoGpsData | null> {
  // 1. First attempt: Server-Side Gemini 3.8 Flash Vision OCR
  // Highly accurate for GPS Map Camera watermarks, stamps, and coordinates
  try {
    const base64Data = await fileToBase64(fileOrDataUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/extract-gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result && result.hasGps && typeof result.latitude === 'number' && typeof result.longitude === 'number') {
        const formattedCoords =
          result.formattedCoords || `Lat ${result.latitude.toFixed(6)}° Long ${result.longitude.toFixed(6)}°`;
        const locationText = result.location || result.cityOrArea || formattedCoords;

        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedCoords,
          formattedLocation: locationText,
          address: result.location,
          city: result.cityOrArea,
          timestamp: result.dateOrTimestamp,
          source: 'gemini',
        };
      }
    }
  } catch (geminiErr) {
    // Non-fatal, continue to EXIF and client OCR
  }

  // 2. Second attempt: EXIF GPS metadata embedded directly in image binary
  try {
    const exifGps = await exifr.gps(fileOrDataUrl);
    if (exifGps && typeof exifGps.latitude === 'number' && typeof exifGps.longitude === 'number') {
      const { latitude, longitude } = exifGps;
      const address = await reverseGeocodeCoords(latitude, longitude);
      const formattedCoords = `Lat ${latitude.toFixed(6)}° Long ${longitude.toFixed(6)}°`;
      const formatted = address ? `${address} (${formattedCoords})` : formattedCoords;

      return {
        latitude,
        longitude,
        formattedCoords,
        formattedLocation: formatted,
        source: 'exif',
        address,
      };
    }
  } catch (exifErr) {
    // Continue to OCR
  }

  // 3. Third attempt: Client-side Tesseract OCR on bottom watermark area
  try {
    const croppedImage = await cropGpsWatermarkArea(fileOrDataUrl);
    if (croppedImage) {
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
        const formattedCoords = parsed.rawCoords || `Lat ${parsed.latitude.toFixed(6)}° Long ${parsed.longitude.toFixed(6)}°`;
        const formatted = finalAddress ? `${finalAddress} (${formattedCoords})` : formattedCoords;

        return {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          formattedCoords,
          formattedLocation: formatted,
          source: 'ocr',
          address: finalAddress,
          confidence: ret.data.confidence,
        };
      }
    }
  } catch (ocrErr) {
    console.warn('OCR GPS extraction notice:', ocrErr);
  }

  return null;
}
