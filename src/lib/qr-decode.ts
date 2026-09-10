import jsQR from 'jsqr';

export type DecodeResult = string | null;

/**
 * Decode QR dari ImageData mentah.
 * Dipakai fallback iOS ketika BarcodeDetector tidak tersedia.
 * Aman untuk di-unit-test (tidak akses DOM).
 */
export function decodeFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): DecodeResult {
  try {
    const result = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
    return result?.data || null;
  } catch {
    return null;
  }
}

/**
 * Decode dari canvas yang sudah di-drawImage(video).
 * Dipakai fallback live-scan & galeri.
 */
export function decodeFromCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): DecodeResult {
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return decodeFromImageData(imageData.data, imageData.width, imageData.height);
  } catch {
    return null;
  }
}

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export async function getSupportedBarcodeFormats(): Promise<string[]> {
  try {
    const w = window as unknown as {
      BarcodeDetector?: { getSupportedFormats?: () => Promise<string[]> };
    };
    if (w.BarcodeDetector?.getSupportedFormats) {
      return await w.BarcodeDetector.getSupportedFormats();
    }
  } catch {
    // abaikan
  }
  return [];
}
