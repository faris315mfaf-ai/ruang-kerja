/**
 * Label rapat bersama: RSVP (enum web yes|maybe|no|pending), status notulen,
 * dan pengulangan seri — dipakai agenda, detail, notulen, dan kalender.
 */
import type { Tone } from '@/components/ui';
import type { RsvpValue } from '@/api/types';

export const LABEL_RSVP: Record<RsvpValue, string> = {
  yes: 'Hadir',
  maybe: 'Mungkin',
  no: 'Tidak hadir',
  pending: 'Belum menjawab',
};

export const TONE_RSVP: Record<RsvpValue, Tone> = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
  pending: 'neutral',
};

export const LABEL_NOTULEN: Record<'none' | 'draft' | 'final', string> = {
  none: 'Belum ada notulen',
  draft: 'Draf notulen',
  final: 'Notulen final',
};

export const TONE_NOTULEN: Record<'none' | 'draft' | 'final', Tone> = {
  none: 'neutral',
  draft: 'warning',
  final: 'success',
};

const LABEL_PENGULANGAN: Record<string, string> = {
  weekdays: 'Setiap hari kerja',
  weekly: 'Mingguan',
  mon_wed_fri: 'Sen/Rab/Jum',
};

export function labelPengulangan(nilai: string, until: string | null): string | null {
  const label = LABEL_PENGULANGAN[nilai];
  if (!label) {
    return null;
  }
  return until ? `${label} s.d. ${until}` : label;
}
