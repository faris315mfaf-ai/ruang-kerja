/**
 * "Waktu bicara" — port murni dari web (talk-time.ts + TalkStore). Ponsel
 * menghitung semua pembicara dari event active-speaker LiveKit; total milik
 * sendiri dilaporkan ke server tiap 15 detik (kumulatif, mulai dari `mine_ms`).
 * Server menyimpan nilai terbesar per orang. Label UI: bukan penilaian kinerja.
 */
import type { WaktuBicara } from '@/api/video';

export type TalkTotals = Record<string, number>;

interface TalkState {
  totals: TalkTotals;
  speaking: string[];
  since: number;
}

/** Celah > 10 detik (aplikasi tertidur, jam melompat) diabaikan. */
const MAX_STEP_MS = 10_000;

function recordSpeakers(state: TalkState, speaking: string[], now: number): TalkState {
  const step = Math.min(Math.max(0, now - state.since), MAX_STEP_MS);
  const totals = { ...state.totals };
  for (const identity of state.speaking) {
    totals[identity] = (totals[identity] ?? 0) + step;
  }
  return { totals, speaking: [...new Set(speaking)], since: now };
}

function mergeTotals(a: TalkTotals, b: TalkTotals): TalkTotals {
  const merged: TalkTotals = { ...a };
  for (const [identity, ms] of Object.entries(b)) {
    merged[identity] = Math.max(merged[identity] ?? 0, ms);
  }
  return merged;
}

function dariServer(data: WaktuBicara | null): TalkTotals {
  const hasil: TalkTotals = {};
  for (const p of data?.people ?? []) {
    hasil[p.user_id] = p.ms;
  }
  return hasil;
}

export class TalkStore {
  private state: TalkState;
  private server: TalkTotals;
  private base: number;
  silent: string[];

  constructor(
    private readonly me: string,
    initial: WaktuBicara | null,
  ) {
    this.state = { totals: {}, speaking: [], since: Date.now() };
    this.server = dariServer(initial);
    this.base = initial?.mine_ms ?? 0;
    this.silent = initial?.silent ?? [];
  }

  record(speakers: string[], now: number): void {
    this.state = recordSpeakers(this.state, speakers, now);
  }

  apply(data: WaktuBicara): void {
    this.server = dariServer(data);
    this.silent = data.silent;
    if (typeof data.mine_ms === 'number' && data.mine_ms > this.mine(Date.now())) {
      // Server lebih tinggi (mis. sesi sebelumnya): lanjutkan dari sana.
      this.base = data.mine_ms - (recordSpeakers(this.state, this.state.speaking, Date.now()).totals[this.me] ?? 0);
    }
  }

  /** Total milik sendiri: nilai server awal + hitungan perangkat ini. */
  mine(now: number): number {
    return this.base + (recordSpeakers(this.state, this.state.speaking, now).totals[this.me] ?? 0);
  }

  totals(now: number): TalkTotals {
    return mergeTotals(this.server, { ...recordSpeakers(this.state, this.state.speaking, now).totals, [this.me]: this.mine(now) });
  }
}

export interface TalkRow {
  id: string;
  ms: number;
  share: number;
  relative: number;
}

export function talkRows(totals: TalkTotals, ids: string[]): TalkRow[] {
  const all = [...new Set([...ids, ...Object.keys(totals)])];
  const sum = all.reduce((total, id) => total + (totals[id] ?? 0), 0);
  const top = Math.max(0, ...all.map((id) => totals[id] ?? 0));
  return all
    .map((id) => {
      const ms = totals[id] ?? 0;
      return { id, ms, share: sum > 0 ? ms / sum : 0, relative: top > 0 ? ms / top : 0 };
    })
    .sort((a, b) => b.ms - a.ms);
}

/** "4 mnt 20 dtk" / "38 dtk" / "belum bicara". */
export function durasiBicara(ms: number): string {
  if (ms < 1000) {
    return 'belum bicara';
  }
  const detik = Math.round(ms / 1000);
  const menit = Math.floor(detik / 60);
  const sisa = detik % 60;
  if (menit === 0) {
    return `${sisa} dtk`;
  }
  return sisa === 0 ? `${menit} mnt` : `${menit} mnt ${sisa} dtk`;
}

export function talkSummary(rows: TalkRow[], nameOf: (id: string) => string): string | null {
  const top = rows[0];
  if (!top || top.ms === 0) {
    return null;
  }
  const parts = [`${nameOf(top.id)} bicara ${Math.round(top.share * 100)}% waktu rapat.`];
  const silent = rows.filter((row) => row.ms < 1000).map((row) => nameOf(row.id));
  if (silent.length === 1) {
    parts.push(`${silent[0] ?? ''} belum bicara.`);
  } else if (silent.length === 2) {
    parts.push(`${silent[0] ?? ''} dan ${silent[1] ?? ''} belum bicara.`);
  } else if (silent.length > 2) {
    parts.push(`${silent.length} orang belum bicara.`);
  }
  return parts.join(' ');
}
