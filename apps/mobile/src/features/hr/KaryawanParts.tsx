/** Bagian layar Karyawan (mockup 11 › 02–03): baris daftar, sheet filter, sheet pratinjau. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { BarisKaryawan, DaftarKaryawan, KodePeranHr, StatusKaryawan, UrutKaryawan } from '@/api/hr';
import { labelDariKode } from '@/features/settings/profile';
import { tanggalDariYMD } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, BottomSheet, Button, Chip, Icon, Pressable, Radio, Tag, Text } from '@/ui';

import { labelModeKerja, statusKaryawan } from './format';

export function jabatanDivisi(e: Pick<BarisKaryawan, 'position' | 'division'>): string {
  return [e.position?.name, e.division?.name].filter((x): x is string => !!x).join(' · ') || 'Belum ditempatkan';
}

export function BarisKaryawanItem({ e, pertama, onPress }: { e: BarisKaryawan; pertama: boolean; onPress: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const st = statusKaryawan(e.status);
  return (
    <Pressable
      onPress={onPress}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}, ${jabatanDivisi(e)}, ${labelModeKerja(e.work_mode)}, ${st.label}`}
      style={[s.baris, !pertama ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
    >
      <Avatar name={e.name} size="md" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={1}>
          {e.name}
        </Text>
        <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
          {jabatanDivisi(e)}
        </Text>
        <View style={s.lencana}>
          <Tag tone="neutral">{labelModeKerja(e.work_mode)}</Tag>
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

export interface PilihanFilter {
  status: StatusKaryawan | null;
  role: KodePeranHr | null;
  sort: UrutKaryawan;
}

const LABEL_URUT: Record<UrutKaryawan, string> = {
  name: 'Nama A–Z',
  division: 'Divisi',
  position: 'Jabatan',
  manager: 'Atasan langsung',
  work_mode: 'Mode kerja',
  joined_at: 'Tanggal bergabung',
  status: 'Status',
};

export function SheetFilterKaryawan({
  visible,
  nilai,
  opsi,
  onClose,
  onTerapkan,
}: {
  visible: boolean;
  nilai: PilihanFilter;
  opsi: DaftarKaryawan['options'] | null;
  onClose: () => void;
  onTerapkan: (v: PilihanFilter) => void;
}): React.JSX.Element {
  const [draf, setDraf] = useState(nilai);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang saat sheet dibuka
    if (visible) setDraf(nilai);
  }, [visible, nilai]);
  const status = opsi?.statuses ?? [];
  const peran = opsi?.roles ?? [];
  const urut = opsi?.sorts ?? ['name'];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filter karyawan" scrollable>
      <Text variant="overline">Status</Text>
      <View style={s.bungkus}>
        {status.map((o) => (
          <Chip key={o.value} label={o.label} selected={draf.status === o.value} onPress={() => setDraf({ ...draf, status: o.value })} />
        ))}
        <Chip label="Semua" selected={draf.status === null} onPress={() => setDraf({ ...draf, status: null })} />
      </View>
      <Text variant="overline">Peran</Text>
      <View style={s.bungkus}>
        <Chip label="Semua" selected={draf.role === null} onPress={() => setDraf({ ...draf, role: null })} />
        {peran.map((o) => (
          <Chip key={o.value} label={o.label} selected={draf.role === o.value} onPress={() => setDraf({ ...draf, role: o.value })} />
        ))}
      </View>
      <Text variant="overline">Urutkan</Text>
      <View accessibilityRole="radiogroup">
        {urut.map((u) => (
          <Radio key={u} label={LABEL_URUT[u] ?? u} selected={draf.sort === u} onSelect={() => setDraf({ ...draf, sort: u })} />
        ))}
      </View>
      <View style={s.aksi}>
        <Button title="Atur ulang" variant="quiet" onPress={() => setDraf({ status: 'active', role: null, sort: 'name' })} style={{ flex: 1 }} />
        <Button title="Terapkan" onPress={() => onTerapkan(draf)} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}

function BarisDefinisi({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={s.def}>
      <Text variant="meta" style={{ fontSize: 14, width: 120 }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text variant="body">{children}</Text> : children}</View>
    </View>
  );
}

export { BarisDefinisi };

export function SheetPratinjauKaryawan({ e, onClose }: { e: BarisKaryawan | null; onClose: () => void }): React.JSX.Element {
  const st = e ? statusKaryawan(e.status) : null;
  return (
    <BottomSheet visible={e !== null} onClose={onClose} scrollable>
      {e && st ? (
        <View style={{ gap: 12 }}>
          <View style={s.kepala}>
            <Avatar name={e.name} size="lg" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3" accessibilityRole="header">
                {e.name}
              </Text>
              <Text variant="meta" style={{ fontSize: 14 }}>
                {jabatanDivisi(e)}
              </Text>
              <Badge tone={st.tone} dot>
                {st.label}
              </Badge>
            </View>
          </View>
          <BarisDefinisi label="Email">{e.email}</BarisDefinisi>
          <BarisDefinisi label="Atasan langsung">{e.manager?.name ?? '—'}</BarisDefinisi>
          <BarisDefinisi label="Tim">{e.team?.name ?? '—'}</BarisDefinisi>
          <BarisDefinisi label="Mode kerja">{labelModeKerja(e.work_mode)}</BarisDefinisi>
          <BarisDefinisi label="Peran">{labelDariKode(e.roles).join(', ') || '—'}</BarisDefinisi>
          <BarisDefinisi label="Bergabung">{e.joined_at ? tanggalDariYMD(e.joined_at) : '—'}</BarisDefinisi>
          <View style={s.aksi}>
            <Button title="Hubungi via email" variant="outline" icon="mail" onPress={() => void Linking.openURL(`mailto:${e.email}`)} style={{ flex: 1 }} />
            <Button
              title="Lihat profil"
              onPress={() => {
                onClose();
                router.push(`/karyawan/${e.id}` as never);
              }}
              style={{ flex: 1 }}
            />
          </View>
          <Text variant="meta" style={{ fontSize: 14 }}>
            Ubah data, divisi, atau peran lewat desktop.
          </Text>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aksi: { flexDirection: 'row', gap: 10, marginTop: 4 },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  def: { flexDirection: 'row', gap: 12, minHeight: 32, alignItems: 'flex-start' },
});
