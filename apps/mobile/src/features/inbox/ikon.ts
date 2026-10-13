/**
 * Pemetaan `icon` + `tone` dari server ke ikon Lucide + nada ubin aplikasi
 * (satu berkas; spec 10 §9). Ikon yang tidak dikenal → lonceng.
 */
import type { AnyIconName, IconTileTone } from '@/ui';

const IKON: Record<string, AnyIconName> = {
  plus: 'plus',
  'at-sign': 'at-sign',
  message: 'message-square',
  'calendar-clock': 'calendar-clock',
  alert: 'circle-alert',
  'check-check': 'check-check',
  x: 'circle-x',
  rotate: 'rotate-ccw',
  alarm: 'alarm-clock',
  megaphone: 'megaphone',
  bell: 'bell',
  shield: 'shield',
  target: 'target',
  workflow: 'workflow',
  video: 'video',
  notebook: 'notebook-pen',
  key: 'key-round',
  clipboard: 'clipboard-pen',
  'user-plus': 'user-plus',
  'user-check': 'user-check',
};

export function ikonNotifikasi(nama: string): AnyIconName {
  return IKON[nama] ?? 'bell';
}

const NADA: Record<string, IconTileTone> = {
  primary: 'teal',
  info: 'blue',
  success: 'ok',
  warning: 'warn',
  danger: 'bad',
  neutral: 'neutral',
};

export function nadaNotifikasi(nada: string): IconTileTone {
  return NADA[nada] ?? 'neutral';
}
