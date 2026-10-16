/**
 * Sheet "Filter tugas · KEY" (mockup 05 › 20-1): cari, penanggung jawab,
 * prioritas, label, tenggat (+ urutan & tampilkan selesai untuk List).
 * Draf dikerjakan lokal lalu "Terapkan".
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FilterTugas, LabelRef, UrutTugas } from '@/api/workspace';
import { FILTER_KOSONG } from '@/api/workspace';
import { BottomSheet, Button, Chip, ChipScroller, Input, Switch, Text } from '@/ui';

import { LABEL_PRIORITAS } from './util';

const TENGGAT: { nilai: FilterTugas['tenggat']; label: string }[] = [
  { nilai: 'overdue', label: 'Terlambat' },
  { nilai: 'today', label: 'Hari ini' },
  { nilai: 'week', label: 'Minggu ini' },
  { nilai: 'none', label: 'Tanpa tenggat' },
];

const URUT: { nilai: UrutTugas; label: string }[] = [
  { nilai: 'tenggat', label: 'Tenggat' },
  { nilai: 'prioritas', label: 'Prioritas' },
  { nilai: 'terbaru', label: 'Terbaru' },
  { nilai: 'nomor', label: 'Nomor' },
];

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="overline" tone="muted">
        {judul.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

export function FilterSheet({
  visible,
  kunci,
  filter,
  labels,
  anggota,
  modeList,
  jumlahCocok,
  onTerapkan,
  onClose,
}: {
  visible: boolean;
  /** Judul: "Filter tugas · PLQ". */
  kunci: string;
  filter: FilterTugas;
  labels: LabelRef[];
  anggota: { id: string; name: string }[];
  modeList: boolean;
  /** Hitung kartu yang cocok untuk draf (papan); null = tidak diketahui. */
  jumlahCocok?: ((draf: FilterTugas) => number) | null;
  onTerapkan: (f: FilterTugas) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [draf, setDraf] = useState<FilterTugas>(filter);
  const [terbukaUntuk, setTerbukaUntuk] = useState(visible);
  if (visible !== terbukaUntuk) {
    // Salin filter aktif ke draf setiap sheet dibuka.
    setTerbukaUntuk(visible);
    if (visible) {
      setDraf(filter);
    }
  }

  const ubah = (bagian: Partial<FilterTugas>): void => setDraf((d) => ({ ...d, ...bagian }));
  const cocok = jumlahCocok ? jumlahCocok(draf) : null;
  const tombol = cocok !== null ? `Terapkan · ${cocok} cocok` : 'Terapkan';

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Filter tugas · ${kunci}`} scrollable>
      <Input value={draf.q} onChangeText={(q) => ubah({ q })} placeholder="Judul, ID, atau deskripsi" leftIcon="search" returnKeyType="search" accessibilityLabel="Cari tugas" />

      <Bagian judul="Penanggung jawab">
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label="Saya" selected={draf.assignee === 'me'} onPress={() => ubah({ assignee: draf.assignee === 'me' ? '' : 'me' })} />
          <Chip label="Belum ditugaskan" selected={draf.assignee === 'none'} onPress={() => ubah({ assignee: draf.assignee === 'none' ? '' : 'none' })} />
          {anggota.map((a) => (
            <Chip key={a.id} label={a.name.split(' ')[0] ?? a.name} selected={draf.assignee === a.id} onPress={() => ubah({ assignee: draf.assignee === a.id ? '' : a.id })} />
          ))}
        </ChipScroller>
      </Bagian>

      <Bagian judul="Prioritas">
        <View style={s.bungkus}>
          {[1, 2, 3, 4, 0].map((p) => (
            <Chip
              key={p}
              label={LABEL_PRIORITAS[p] ?? ''}
              variant="tonal"
              selected={draf.prioritas.includes(p)}
              onPress={() => ubah({ prioritas: draf.prioritas.includes(p) ? draf.prioritas.filter((x) => x !== p) : [...draf.prioritas, p] })}
            />
          ))}
        </View>
      </Bagian>

      {labels.length > 0 ? (
        <Bagian judul="Label">
          <View style={s.bungkus}>
            {labels.map((l) => (
              <Chip
                key={l.id}
                label={l.name}
                variant="tonal"
                selected={draf.label.includes(l.id)}
                onPress={() => ubah({ label: draf.label.includes(l.id) ? draf.label.filter((x) => x !== l.id) : [...draf.label, l.id] })}
              />
            ))}
          </View>
        </Bagian>
      ) : null}

      <Bagian judul="Tenggat">
        <View style={s.bungkus}>
          {TENGGAT.map((t) => (
            <Chip key={t.nilai} label={t.label} selected={draf.tenggat === t.nilai} onPress={() => ubah({ tenggat: draf.tenggat === t.nilai ? '' : t.nilai })} />
          ))}
        </View>
      </Bagian>

      {modeList ? (
        <>
          <Bagian judul="Urutkan">
            <View style={s.bungkus}>
              {URUT.map((u) => (
                <Chip key={u.nilai} label={u.label} selected={draf.urut === u.nilai} onPress={() => ubah({ urut: u.nilai })} />
              ))}
            </View>
          </Bagian>
          <View style={s.baris}>
            <Text variant="body" style={{ flex: 1 }}>
              Tampilkan semua tugas selesai
            </Text>
            <Switch value={draf.selesai} onValueChange={(selesai) => ubah({ selesai })} label="Tampilkan semua tugas selesai" />
          </View>
        </>
      ) : null}

      <View style={s.baris}>
        <View style={{ flex: 1 }}>
          <Button title="Hapus filter" variant="outline" onPress={() => { setDraf({ ...FILTER_KOSONG, urut: draf.urut, selesai: draf.selesai }); }} />
        </View>
        <View style={{ flex: 1.4 }}>
          <Button title={tombol} onPress={() => onTerapkan(draf)} />
        </View>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
