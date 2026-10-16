/**
 * Kotak subtitle di atas bilah kontrol (`roomCaption`): dua baris terakhir
 * dari worker `rk-notulen`, nama pembicara bergiliran tiga warna.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Text } from '@/ui';

import { CAPTION_HOLD_MS, showSpeakerName, visibleCaptions, type CaptionLine } from './captions';

export function Subtitle({ lines, nama }: { lines: CaptionLine[]; nama: (identity: string) => string }): React.JSX.Element | null {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const terakhir = lines[lines.length - 1]?.at ?? 0;

  useEffect(() => {
    if (terakhir === 0) {
      return;
    }
// eslint-disable-next-line react-hooks/set-state-in-effect -- mulai jam tampil saat baris baru tiba
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    const stop = setTimeout(() => clearInterval(t), CAPTION_HOLD_MS + 1000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [terakhir]);

  const tampil = visibleCaptions(lines, now);
  if (tampil.length === 0) {
    return null;
  }
  const urutan: string[] = [];
  for (const l of lines) {
    if (!urutan.includes(l.speaker)) {
      urutan.push(l.speaker);
    }
  }
  return (
    <View style={[s.kotak, { backgroundColor: colors.roomCaption }]} accessibilityLiveRegion="polite" accessibilityLabel="Subtitle">
      {tampil.map((l, i) => {
        const warna = colors.roomCaptionNames[urutan.indexOf(l.speaker) % 3] ?? colors.roomCaptionNames[0];
        const baru = i === tampil.length - 1;
        return (
          <Text key={l.segmentId} variant={baru ? 'body' : 'meta'} style={{ color: baru ? colors.roomOnCaption : colors.roomCaptionMuted }}>
            {showSpeakerName(tampil, i) ? (
              <Text variant={baru ? 'body' : 'meta'} weight={700} style={{ color: warna }}>
                {`${nama(l.speaker).split(/\s+/)[0] ?? ''} `}
              </Text>
            ) : null}
            {l.text}
          </Text>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kotak: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
});
