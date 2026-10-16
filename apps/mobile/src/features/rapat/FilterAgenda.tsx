/**
 * Lembar "Filter agenda" (mockup 03-2): peran saya, tempat, hanya yang belum
 * dijawab, tampilkan yang dibatalkan. Disaring di klien dari baris agenda.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MeetingItem } from '@/api/types';
import { BottomSheet, Button, Chip, Pressable, Switch, Text } from '@/ui';

export interface FilterRapat {
  peran: 'semua' | 'penyelenggara' | 'diundang';
  tempat: string[];
  belumDijawab: boolean;
  dibatalkan: boolean;
}

export const FILTER_AWAL: FilterRapat = { peran: 'semua', tempat: [], belumDijawab: false, dibatalkan: true };

export function filterAktif(f: FilterRapat): boolean {
  return f.peran !== 'semua' || f.tempat.length > 0 || f.belumDijawab || !f.dibatalkan;
}

const TEMPAT: { kode: string; label: string; platform: string[] }[] = [
  { kode: 'video', label: 'Video RuangKerja', platform: ['video'] },
  { kode: 'meet', label: 'Meet', platform: ['meet'] },
  { kode: 'zoom', label: 'Zoom', platform: ['zoom'] },
  { kode: 'muka', label: 'Tatap muka', platform: ['room', 'client'] },
];

export function terapkanFilter(items: MeetingItem[], f: FilterRapat, viewerId: string | null): MeetingItem[] {
  const platform = new Set(TEMPAT.filter((t) => f.tempat.includes(t.kode)).flatMap((t) => t.platform));
  return items.filter((item) => {
    const saya = viewerId !== null && item.organizer.id === viewerId;
    if (f.peran === 'penyelenggara' && !saya) {
      return false;
    }
    if (f.peran === 'diundang' && saya) {
      return false;
    }
    if (platform.size > 0 && !platform.has(item.platform)) {
      return false;
    }
    if (f.belumDijawab && item.rsvp_saya !== 'pending') {
      return false;
    }
    if (!f.dibatalkan && item.canceled) {
      return false;
    }
    return true;
  });
}

export function FilterAgenda({
  visible,
  onClose,
  nilai,
  onTerapkan,
  items,
  viewerId,
}: {
  visible: boolean;
  onClose: () => void;
  nilai: FilterRapat;
  onTerapkan: (f: FilterRapat) => void;
  items: MeetingItem[];
  viewerId: string | null;
}): React.JSX.Element {
  const [f, setF] = useState<FilterRapat>(nilai);
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- salin filter aktif saat lembar dibuka
      setF(nilai);
    }
  }, [visible, nilai]);
  const jumlah = terapkanFilter(items, f, viewerId).length;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={s.kepala}>
        <Text variant="h3" style={{ flex: 1 }} accessibilityRole="header">
          Filter agenda
        </Text>
        <Pressable onPress={() => setF(FILTER_AWAL)} accessibilityRole="button" accessibilityLabel="Atur ulang filter" hitSlop={10}>
          <Text variant="label" tone="link">
            Atur ulang
          </Text>
        </Pressable>
      </View>
      <Text variant="label">Peran saya</Text>
      <View style={s.bungkus}>
        {(
          [
            ['semua', 'Semua'],
            ['penyelenggara', 'Penyelenggara'],
            ['diundang', 'Diundang'],
          ] as const
        ).map(([kode, label]) => (
          <Chip key={kode} label={label} selected={f.peran === kode} onPress={() => setF({ ...f, peran: kode })} />
        ))}
      </View>
      <Text variant="label">Tempat</Text>
      <View style={s.bungkus}>
        {TEMPAT.map((t) => {
          const aktif = f.tempat.includes(t.kode);
          return (
            <Chip
              key={t.kode}
              label={t.label}
              variant="tonal"
              selected={aktif}
              icon={t.kode === 'video' ? 'video' : undefined}
              onPress={() => setF({ ...f, tempat: aktif ? f.tempat.filter((x) => x !== t.kode) : [...f.tempat, t.kode] })}
            />
          );
        })}
      </View>
      <View style={s.saklar}>
        <View style={{ flex: 1 }}>
          <Text variant="label">Hanya yang belum saya jawab</Text>
          <Text variant="meta">Sembunyikan rapat yang sudah Anda jawab</Text>
        </View>
        <Switch value={f.belumDijawab} onValueChange={(v) => setF({ ...f, belumDijawab: v })} label="Hanya yang belum saya jawab" />
      </View>
      <View style={s.saklar}>
        <Text variant="label" style={{ flex: 1 }}>
          Tampilkan yang dibatalkan
        </Text>
        <Switch value={f.dibatalkan} onValueChange={(v) => setF({ ...f, dibatalkan: v })} label="Tampilkan yang dibatalkan" />
      </View>
      <Button
        title={`Terapkan · ${jumlah} rapat`}
        onPress={() => {
          onTerapkan(f);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saklar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
});
