/**
 * Serah terima pra-gabung → ruang (dalam memori, per proses aplikasi):
 * pilihan perangkat dan token LiveKit yang baru diterbitkan (TTL 10 menit;
 * dipakai ulang bila masih > 2 menit, selain itu ruang meminta token baru).
 */
import type { TokenVideo } from '@/api/video';

export type ArahKamera = 'user' | 'environment';
/** Nilai `AudioSession.getAudioOutputs()` Android: speaker · earpiece · headset · bluetooth. */
export type KeluaranSuara = string;

export interface PilihanPerangkat {
  mic: boolean;
  kamera: boolean;
  arah: ArahKamera;
  keluaran: KeluaranSuara;
  hematData: boolean;
}

const BAWAAN: PilihanPerangkat = { mic: true, kamera: true, arah: 'user', keluaran: 'speaker', hematData: false };

let pilihan: PilihanPerangkat = { ...BAWAAN };
const tokenTersimpan = new Map<string, TokenVideo>();

export function ambilPilihan(): PilihanPerangkat {
  return pilihan;
}

export function simpanPilihan(baru: Partial<PilihanPerangkat>): PilihanPerangkat {
  pilihan = { ...pilihan, ...baru };
  return pilihan;
}

function kunci(meetingId: string, tanggal: string | null | undefined): string {
  return `${meetingId}|${tanggal ?? ''}`;
}

export function simpanToken(meetingId: string, tanggal: string | null | undefined, token: TokenVideo): void {
  tokenTersimpan.set(kunci(meetingId, tanggal), token);
}

/** Token sekali pakai: diambil lalu dihapus; null bila kedaluwarsa < 2 menit lagi. */
export function pakaiToken(meetingId: string, tanggal: string | null | undefined): TokenVideo | null {
  const k = kunci(meetingId, tanggal);
  const t = tokenTersimpan.get(k) ?? null;
  tokenTersimpan.delete(k);
  if (t === null) {
    return null;
  }
  const sisa = new Date(t.expires_at).getTime() - Date.now();
  return Number.isFinite(sisa) && sisa > 120_000 ? t : null;
}

export const LABEL_KELUARAN: Record<string, { label: string; meta: string; ikon: 'volume-2' | 'ear' | 'bluetooth' | 'headphones' }> = {
  speaker: { label: 'Speaker', meta: 'Ponsel ini', ikon: 'volume-2' },
  earpiece: { label: 'Earpiece', meta: 'Telinga', ikon: 'ear' },
  headset: { label: 'Headset berkabel', meta: 'Tersambung', ikon: 'headphones' },
  bluetooth: { label: 'Bluetooth', meta: 'Tersambung', ikon: 'bluetooth' },
};

export function labelKeluaran(nilai: string): string {
  return LABEL_KELUARAN[nilai]?.label ?? nilai;
}
