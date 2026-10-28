/**
 * Image downscaling for report photos.
 *
 * Phone photos are 4-7 MB as base64, over the vision route's 4 MB guard and Vercel's
 * 4.5 MB body cap. 1024 px JPEG at q0.7 is ~100-150 KB and still enough for triage.
 */

const MAX_PX = 1024;
const QUALITY = 0.7;

export function toJpegDataUrl(source: CanvasImageSource, width: number, height: number): string {
    const scale = Math.min(1, MAX_PX / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', QUALITY);
}

export async function fileToJpegDataUrl(file: Blob): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
        return toJpegDataUrl(bitmap, bitmap.width, bitmap.height);
    } finally {
        bitmap.close();
    }
}
