/** Page states a preview can be forced into with `?keadaan=` (QA aid). */
export type PreviewState = 'normal' | 'memuat' | 'kosong' | 'galat';

/** Reads `?keadaan=` from an Inertia page URL ("/okr?keadaan=kosong"). */
export function parsePreviewState(url: string): PreviewState {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const value = new URLSearchParams(query).get('keadaan');

    return value === 'memuat' || value === 'kosong' || value === 'galat'
        ? value
        : 'normal';
}
