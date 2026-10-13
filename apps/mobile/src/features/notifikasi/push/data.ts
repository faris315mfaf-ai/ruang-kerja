/**
 * Muatan `data` push FCM (kontrak: docs/sesi/ponsel-b2c-inbox.md §5) dan
 * penerjemahannya ke tujuan ketukan. Murni (tanpa React Native) agar bisa
 * diuji di Node: `node scripts/cek-push.mjs`.
 */
import type { TargetLike } from '../../inbox/target';

export interface DataPush {
  /** `NotificationType`, mis. `task.commented`. */
  type: string;
  /** Jenis target (`tugas`, `rapat`, …) atau `inbox` bila tanpa layar tujuan. */
  target: string;
  /** Id target; untuk `target = inbox` = id notifikasi. */
  id: string;
  anchor: string;
  /** Objek JSON dalam bentuk string. */
  params: string;
  android_channel: string;
  /** Id baris Inbox (dibaca saat dibuka). */
  notification_id: string;
  /** Petunjuk pengelompokan (saluran, atau `chat:{kanal}`). */
  group_key: string;
  /** `1` bila notifikasi dibuat aplikasi sendiri (uji lokal), bukan dari server. */
  lokal: string;
}

function teks(nilai: unknown): string {
  return typeof nilai === 'string' ? nilai : '';
}

/** Ambil `DataPush` dari `content.data` notifikasi Expo; `null` bila bukan push RuangKerja. */
export function bacaDataPush(data: unknown): DataPush | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const mentah = data as Record<string, unknown>;
  const type = teks(mentah.type);
  const target = teks(mentah.target);
  if (type === '' && target === '') {
    return null;
  }
  return {
    type,
    target,
    id: teks(mentah.id),
    anchor: teks(mentah.anchor),
    params: teks(mentah.params),
    android_channel: teks(mentah.android_channel),
    notification_id: teks(mentah.notification_id),
    group_key: teks(mentah.group_key),
    lokal: teks(mentah.lokal),
  };
}

function bacaParams(params: string): Record<string, string> {
  if (params === '' || params === '{}') {
    return {};
  }
  try {
    const nilai: unknown = JSON.parse(params);
    if (typeof nilai !== 'object' || nilai === null || Array.isArray(nilai)) {
      return {};
    }
    const hasil: Record<string, string> = {};
    for (const [k, v] of Object.entries(nilai)) {
      if (typeof v === 'string') {
        hasil[k] = v;
      }
    }
    return hasil;
  } catch {
    return {};
  }
}

/** Target untuk `resolveTarget`; `null` = lembar detail Inbox (`target = inbox` atau data rusak). */
export function targetDariPush(data: DataPush): TargetLike | null {
  if (data.target === '' || data.target === 'inbox') {
    return null;
  }
  return {
    type: data.target,
    id: data.id === '' ? null : data.id,
    anchor: data.anchor === '' ? null : data.anchor,
    params: bacaParams(data.params),
  };
}

/** Id notifikasi Inbox yang harus ditandai dibaca saat dibuka ('' bila tak ada). */
export function idInboxDariPush(data: DataPush): string {
  if (data.notification_id !== '') {
    return data.notification_id;
  }
  return data.target === 'inbox' ? data.id : '';
}
