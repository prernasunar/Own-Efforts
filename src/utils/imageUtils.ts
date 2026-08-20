/**
 * Utilities for client-side image compression, conversion, sharing, and downloads
 * Designed for mobile field operations where photos need to be saved directly to Firestore docs
 */

export async function compressImage(file: File, maxDimension: number = 960, quality: number = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw and compress to JPEG format
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function processFileList(files: FileList | File[], currentCount: number = 0, maxAllowed: number = 4): Promise<string[]> {
  const remainingSlots = Math.max(0, maxAllowed - currentCount);
  if (remainingSlots <= 0) return [];

  const filesToProcess = Array.from(files).slice(0, remainingSlots);
  const results: string[] = [];

  for (const file of filesToProcess) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const compressed = await compressImage(file);
      results.push(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
    }
  }

  return results;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}

export function downloadPhoto(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadAllPhotos(photos: string[], baseName: string = 'site-work') {
  photos.forEach((photo, idx) => {
    setTimeout(() => {
      downloadPhoto(photo, `${baseName}-photo-${idx + 1}.jpg`);
    }, idx * 250);
  });
}

export async function copyPhotoToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    // Many browsers only accept image/png in ClipboardItem
    if (blob.type === 'image/png') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    }

    // Convert JPEG/WebP to PNG blob via canvas for clipboard compatibility
    const img = new Image();
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => resolve(b), 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

    if (pngBlob && navigator.clipboard && 'write' in navigator.clipboard) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write image error:', err);
  }
  return false;
}

export function canNativeShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  if (typeof navigator.canShare !== 'function') return true;
  try {
    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

export async function shareWithNativeFiles(
  title: string,
  text: string,
  photos: string[] = []
): Promise<{ success: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return { success: false, error: 'Web Share API not supported in this browser.' };
  }

  try {
    const files: File[] = [];
    if (photos && photos.length > 0) {
      photos.forEach((photo, idx) => {
        try {
          const file = dataUrlToFile(photo, `site-photo-${idx + 1}.jpg`);
          files.push(file);
        } catch (e) {
          console.warn('Could not convert dataUrl to File:', e);
        }
      });
    }

    if (files.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
      await navigator.share({
        title,
        text,
        files,
      });
      return { success: true };
    } else {
      // Share text and title
      await navigator.share({
        title,
        text,
      });
      return { success: true };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: true }; // User simply dismissed the share sheet
    }
    console.warn('Navigator share failed:', err);
    return { success: false, error: err.message || 'Share failed' };
  }
}

