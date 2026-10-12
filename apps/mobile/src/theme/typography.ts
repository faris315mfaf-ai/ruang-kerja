/**
 * Skala tipografi ponsel (docs/DESIGN.md §3, kolom "Ponsel"). Teks yang harus
 * dibaca ≥ 15; 13 hanya meta. Angka tabular lewat `fontVariant`.
 */
import type { TextStyle } from 'react-native';

import { fontFamily } from './fonts';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'bodyLg'
  | 'body'
  | 'label'
  | 'meta'
  | 'overline'
  | 'kpi'
  | 'mono';

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const type: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fontFamily[800], fontSize: 32, lineHeight: 40, letterSpacing: -0.8, fontVariant: tabular },
  h1: { fontFamily: fontFamily[700], fontSize: 26, lineHeight: 32, letterSpacing: -0.5, fontVariant: tabular },
  h2: { fontFamily: fontFamily[700], fontSize: 22, lineHeight: 28, fontVariant: tabular },
  h3: { fontFamily: fontFamily[700], fontSize: 20, lineHeight: 26, fontVariant: tabular },
  title: { fontFamily: fontFamily[600], fontSize: 17, lineHeight: 24, fontVariant: tabular },
  bodyLg: { fontFamily: fontFamily[400], fontSize: 18, lineHeight: 28, fontVariant: tabular },
  body: { fontFamily: fontFamily[400], fontSize: 17, lineHeight: 26, fontVariant: tabular },
  label: { fontFamily: fontFamily[600], fontSize: 15, lineHeight: 20, fontVariant: tabular },
  meta: { fontFamily: fontFamily[500], fontSize: 13, lineHeight: 18, fontVariant: tabular },
  overline: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    fontVariant: tabular,
  },
  kpi: { fontFamily: fontFamily[700], fontSize: 28, lineHeight: 34, fontVariant: tabular },
  mono: { fontFamily: fontFamily.mono500, fontSize: 15, lineHeight: 20, fontVariant: tabular },
};
