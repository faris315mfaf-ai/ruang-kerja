/**
 * Client-side selfie compression: JPEG ≤ 300 KB (docs/ARCHITECTURE.md §3.1),
 * so check-in stays under 3 s on 4G.
 */

export const MAX_SELFIE_BYTES = 300 * 1024;

/** Longest side of the stored selfie, in pixels. */
export const MAX_SELFIE_DIMENSION = 960;

const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];
const SCALE_STEP = 0.8;
const MAX_SCALE_STEPS = 4;

/** Encodes the image at a JPEG quality (0–1) and a scale factor (0–1). */
export type Encoder = (quality: number, scale: number) => Promise<Blob>;

/**
 * Lowers the quality first, then the resolution, until the blob fits the
 * budget. Returns the smallest attempt when nothing fits.
 */
export async function encodeWithinBudget(
    encode: Encoder,
    maxBytes = MAX_SELFIE_BYTES,
): Promise<Blob> {
    let smallest: Blob | null = null;
    let scale = 1;

    for (let step = 0; step <= MAX_SCALE_STEPS; step++) {
        for (const quality of QUALITIES) {
            const blob = await encode(quality, scale);

            if (blob.size <= maxBytes) {
                return blob;
            }

            if (!smallest || blob.size < smallest.size) {
                smallest = blob;
            }
        }

        scale *= SCALE_STEP;
    }

    if (!smallest) {
        throw new Error('Foto tidak bisa diproses.');
    }

    return smallest;
}

/** Fits width × height inside `max` on the longest side. */
export function fitWithin(
    width: number,
    height: number,
    max = MAX_SELFIE_DIMENSION,
): { width: number; height: number } {
    const ratio = Math.min(1, max / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio)),
    };
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    quality: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error('Foto tidak bisa diproses.')),
            'image/jpeg',
            quality,
        );
    });
}

/**
 * Draws a video frame / bitmap / image and compresses it to JPEG within the
 * budget. The stored photo is never mirrored (only the live preview is).
 */
export async function compressImage(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    maxBytes = MAX_SELFIE_BYTES,
): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Perangkat tidak mendukung pemrosesan foto.');
    }

    const base = fitWithin(sourceWidth, sourceHeight);

    return encodeWithinBudget(async (quality, scale) => {
        canvas.width = Math.max(1, Math.round(base.width * scale));
        canvas.height = Math.max(1, Math.round(base.height * scale));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);

        return canvasToBlob(canvas, quality);
    }, maxBytes);
}

/** Captures the current frame of a playing <video>. */
export function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
    if (!video.videoWidth || !video.videoHeight) {
        return Promise.reject(
            new Error('Kamera belum siap. Coba lagi sebentar.'),
        );
    }

    return compressImage(video, video.videoWidth, video.videoHeight);
}

/** Compresses a photo picked with <input type="file" capture="user">. */
export async function compressFile(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
    });

    try {
        return await compressImage(bitmap, bitmap.width, bitmap.height);
    } finally {
        bitmap.close();
    }
}
