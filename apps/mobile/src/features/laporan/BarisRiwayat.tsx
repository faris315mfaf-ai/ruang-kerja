/**
 * Baris riwayat per tanggal (mockup 32-1, 34-4): kotak tanggal, lencana
 * Terkirim/Draf/Tidak lapor (+ Hambatan, Libur), ringkasan, "3 pekerjaan · 6,5 jam".
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Badge, Icon, Pressable, Text } from '@/ui';

import { kotakTanggal, ringkasPekerjaan } from './format';

export interface BarisRiwayatProps {
  date: string;
  status: 'submitted' | 'draft' | 'missing';
  summary: string | null;
  hasBlockers: boolean;
  itemsCount: number;
  hours: number | null;
  holiday?: string | null;
  /** Teks pengganti ringkasan untuk draf (pemilik). */
  teksDraf?: string;
  garis: boolean;
  onPress?: () => void;
}

export function BarisRiwayat({ date, status, summary, hasBlockers, itemsCount, hours, holiday, teksDraf, garis, onPress }: BarisRiwayatProps): React.JSX.Element {
  const { colors } = useTheme();
  const k = kotakTanggal(date);
  const label = status === 'submitted' ? 'Terkirim' : status === 'draft' ? 'Draf' : 'Tidak lapor';
  const isi =
    status === 'missing'
      ? 'Tidak ada laporan untuk hari kerja ini.'
      : status === 'draft'
        ? (teksDraf ?? 'Belum dikirim — hanya terlihat oleh Anda.')
        : (summary ?? 'Tanpa ringkasan.');
  const konten = (
    <>
      <View style={s.tanggal}>
        <Text variant="h2" style={{ fontSize: 24, lineHeight: 30 }}>
          {k.angka}
        </Text>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {k.hari}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={s.lencana}>
          <Badge tone={status === 'submitted' ? 'success' : status === 'draft' ? 'warning' : 'danger'}>{label}</Badge>
          {hasBlockers ? (
            <View style={[s.hambatan, { backgroundColor: colors.warningSoft }]}>
              <Icon name="triangle-alert" size={14} color={colors.warning} />
              <Text variant="label" tone="warning" style={{ fontSize: 14 }}>
                Hambatan
              </Text>
            </View>
          ) : null}
          {holiday ? <Badge tone="neutral" dot={false}>{`Libur · ${holiday}`}</Badge> : null}
        </View>
        <Text variant="body" style={{ fontSize: 16, lineHeight: 23, color: status === 'missing' ? colors.muted : colors.text }} numberOfLines={2}>
          {isi}
        </Text>
        {status !== 'missing' ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            {ringkasPekerjaan(itemsCount, hours)}
          </Text>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null}
    </>
  );
  const gaya = [s.baris, garis ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
  return onPress ? (
    <Pressable onPress={onPress} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${k.hari} ${k.angka}, ${label}. ${isi}`} style={gaya}>
      {konten}
    </Pressable>
  ) : (
    <View style={gaya} accessible accessibilityLabel={`${k.hari} ${k.angka}, ${label}`}>
      {konten}
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 16, minHeight: 72 },
  tanggal: { width: 44, alignItems: 'center' },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  hambatan: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 999 },
});
