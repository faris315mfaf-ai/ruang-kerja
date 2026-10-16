/** Kalender bulan: sel bulat per tanggal, ikon kecil di pojok untuk status non-normal, legenda berlabel. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SelHari } from '@/api/absensi';
import { useTheme } from '@/theme';
import { Icon, Pressable, Text } from '@/ui';

import { hariTanggalPendek, kolomSenin } from './tanggal';
import { META, kategoriHari, type KategoriHari } from './statusMeta';

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const URUTAN_LEGENDA: KategoriHari[] = ['hadir', 'terlambat', 'wfh', 'izin', 'koreksi', 'alpha'];

function useWarna(): (k: KategoriHari) => { bg: string; fg: string } {
  const { colors } = useTheme();
  return (k) => {
    switch (k) {
      case 'hadir':
        return { bg: colors.successSoft, fg: colors.success };
      case 'terlambat':
        return { bg: colors.warningSoft, fg: colors.warning };
      case 'wfh':
        return { bg: colors.linkSoft, fg: colors.link };
      case 'izin':
        return { bg: colors.infoSoft, fg: colors.info };
      case 'koreksi':
        return { bg: colors.surface2, fg: colors.fill.violet };
      case 'alpha':
        return { bg: colors.dangerSoft, fg: colors.danger };
      default:
        return { bg: 'transparent', fg: colors.muted };
    }
  };
}

export function KalenderBulan({ hari, dipilih, onPilih, hariIni }: { hari: SelHari[]; dipilih: string | null; onPilih: (tanggal: string) => void; hariIni: string }): React.JSX.Element {
  const { colors } = useTheme();
  const warna = useWarna();
  const [lebar, setLebar] = useState(0);
  const awal = hari[0] ? kolomSenin(hari[0].date) : 0;
  const sel = Math.floor(lebar / 7);
  const baris: (SelHari | null)[][] = [];
  const penuh: (SelHari | null)[] = [...Array<null>(awal).fill(null), ...hari];
  for (let i = 0; i < penuh.length; i += 7) {
    const potong = penuh.slice(i, i + 7);
    while (potong.length < 7) potong.push(null);
    baris.push(potong);
  }

  return (
    <View onLayout={(e) => setLebar(e.nativeEvent.layout.width)} style={{ gap: 4 }}>
      <View style={s.baris}>
        {HARI.map((h) => (
          <View key={h} style={{ width: sel || undefined, flex: sel ? undefined : 1, alignItems: 'center', height: 28, justifyContent: 'center' }}>
            <Text variant="meta" weight={600} style={{ fontSize: 13 }}>
              {h}
            </Text>
          </View>
        ))}
      </View>
      {lebar > 0
        ? baris.map((b, i) => (
            <View key={i} style={s.baris}>
              {b.map((h, j) => {
                if (!h) {
                  return <View key={`k${j}`} style={{ width: sel, height: 52 }} />;
                }
                const k = kategoriHari(h);
                const w = warna(k);
                const aktif = dipilih === h.date;
                const meta = META[k];
                const tanda = h.kind === 'early_leave' ? 'log-out' : meta.ikon;
                return (
                  <View key={h.date} style={{ width: sel, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable
                      onPress={() => onPilih(h.date)}
                      scaleTo={0.94}
                      accessibilityRole="button"
                      accessibilityLabel={`${hariTanggalPendek(h.date)}${h.statusLabel ? `, ${h.statusLabel}` : k === 'libur' ? (h.holidayName ? `, libur ${h.holidayName}` : ', tidak ada jadwal') : ''}`}
                      accessibilityState={{ selected: aktif }}
                      style={[s.sel, { backgroundColor: w.bg, borderColor: aktif ? colors.text : h.date === hariIni ? colors.borderStrong : 'transparent' }]}
                    >
                      <Text variant="title" weight={700} style={{ color: w.fg, fontSize: 16 }}>
                        {Number(h.date.slice(8))}
                      </Text>
                    </Pressable>
                    {tanda ? (
                      <View style={[s.tanda, { backgroundColor: colors.surface }]} pointerEvents="none">
                        <Icon name={tanda} size={11} color={w.fg} strokeWidth={2.4} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))
        : null}
      <View style={s.legenda}>
        {URUTAN_LEGENDA.map((k) => (
          <View key={k} style={s.legendaItem}>
            <View style={[s.titik, { backgroundColor: warnaTitik(k, colors) }]} />
            <Text variant="meta" style={{ fontSize: 14 }}>
              {META[k].label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function warnaTitik(k: KategoriHari, colors: ReturnType<typeof useTheme>['colors']): string {
  switch (k) {
    case 'hadir':
      return colors.success;
    case 'terlambat':
      return colors.fill.warning;
    case 'wfh':
      return colors.fill.teal;
    case 'izin':
      return colors.accentBlue;
    case 'koreksi':
      return colors.fill.violet;
    default:
      return colors.danger;
  }
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row' },
  sel: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tanda: { position: 'absolute', top: 1, right: 2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingHorizontal: 4 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titik: { width: 10, height: 10, borderRadius: 5 },
});
