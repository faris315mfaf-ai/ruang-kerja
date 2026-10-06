/**
 * Screen state of the Obrolan views. With the real backend only `normal`
 * and `kosong` (no conversation yet) occur; `memuat`/`galat` stay for the
 * skeleton and error layouts the components already have.
 */
export type PreviewState = 'normal' | 'memuat' | 'kosong' | 'galat';

export function screenState(channelCount: number): PreviewState {
    return channelCount === 0 ? 'kosong' : 'normal';
}
