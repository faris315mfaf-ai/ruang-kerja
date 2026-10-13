/**
 * Subtitle langsung ruang video — port murni dari web
 * (resources/js/features/meetings/video/captions.ts). Teks datang sebagai
 * text stream LiveKit topik `lk.transcription`, HANYA dari worker notulen
 * `rk-notulen` (identity karyawan = ULID, tidak pernah "rk-notulen"; audit N-07).
 */

export const CAPTION_TOPIC = 'lk.transcription';
export const CAPTION_SOURCE = 'rk-notulen';

/** Baris terakhir bertahan sekian lama setelah pembicara berhenti (ms). */
export const CAPTION_HOLD_MS = 6000;
const MAX_LINES = 6;

export interface CaptionLine {
  segmentId: string;
  speaker: string;
  text: string;
  final: boolean;
  at: number;
}

export function acceptCaptionStream(identity: string): boolean {
  return identity === CAPTION_SOURCE;
}

export function readCaptionAttributes(
  attributes: Record<string, string> | undefined,
  streamId: string,
): { segmentId: string; trackId: string | null; final: boolean } {
  const value = attributes ?? {};
  return {
    segmentId: value['lk.segment_id'] || streamId,
    trackId: value['lk.transcribed_track_id'] || null,
    final: value['lk.transcription_final'] === 'true',
  };
}

/** Tambah/ganti segmen; segmen lama tetap di tempatnya, teks kosong diabaikan. */
export function applyCaption(lines: CaptionLine[], update: CaptionLine): CaptionLine[] {
  const text = update.text.replace(/\s+/g, ' ').trim();
  if (text === '') {
    return lines;
  }
  const index = lines.findIndex((line) => line.segmentId === update.segmentId);
  const current = index >= 0 ? lines[index] : undefined;
  if (current !== undefined) {
    const next: CaptionLine = { ...current, text, final: current.final || update.final, at: update.at };
    return lines.map((line, i) => (i === index ? next : line));
  }
  return [...lines, { ...update, text }].slice(-MAX_LINES);
}

/** Dua baris terakhir selama baris terbaru berubah < CAPTION_HOLD_MS lalu. */
export function visibleCaptions(lines: CaptionLine[], now: number, count = 2): CaptionLine[] {
  const last = lines[lines.length - 1];
  if (!last || now - last.at > CAPTION_HOLD_MS) {
    return [];
  }
  return lines.slice(-count);
}

/** Nama hanya di baris pertama satu giliran bicara. */
export function showSpeakerName(lines: CaptionLine[], index: number): boolean {
  return index === 0 || lines[index - 1]?.speaker !== lines[index]?.speaker;
}
