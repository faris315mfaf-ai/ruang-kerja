/**
 * Sheet "Tugas baru" cepat (mockup 12): judul + chip status/prioritas/
 * penanggung/tenggat/label + pemilih workspace. Tombol perluas membuka form
 * lengkap (`/tugas/baru`) dengan judul & workspace terbawa.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import type { HasilBuat } from '@/offline/fitur/tugas';
import { Avatar, Banner, BottomSheet, Button, Field, Icon, IconButton, Pressable, Text, tanggal, useSnackbar } from '@/ui';
import { radius, useTheme } from '@/theme';

import { PriorityBars, StatusRing, UbinWorkspace } from './ikon';
import { PropChip } from './PropChip';
import { SheetLabel, SheetOrang, SheetInput, SheetPrioritas, SheetStatus, SheetTenggat, SheetWorkspace } from './Pilihan';
import { statusBawaan, useBuatTugas } from './useBuatTugas';
import { LABEL_PRIORITAS, hariSingkat, ringkasLabel } from './util';
import { useSession } from '@/session/SessionProvider';

type Pilih = 'status' | 'prioritas' | 'orang' | 'tenggat' | 'label' | 'workspace' | null;

function Isi({ onDibuat, onClose }: { onDibuat: (t: HasilBuat) => void; onClose: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useSession();
  const snackbar = useSnackbar();
  const f = useBuatTugas({});
  const [pilih, setPilih] = useState<Pilih>(null);
  const hariIni = tanggal.hariIniIso();
  const { draf } = f;
  // Tanpa pilihan, chip menampilkan kolom yang memang dipakai server (Todo), bukan kolom pertama (Backlog).
  const statusDipilih = f.konteks?.statuses.find((s) => s.id === (draf.statusId ?? statusBawaan(f.konteks))) ?? null;
  const namaOrang = (id: string): string => (id === user?.id ? 'Saya' : (f.anggota.find((a) => a.id === id)?.name ?? 'Orang'));
  const labelChip = ringkasLabel(draf.labels, f.konteks?.labels ?? []);
  const penanggung = draf.assignees.length === 0 ? 'Penanggung jawab' : draf.assignees.length === 1 ? namaOrang(draf.assignees[0] as string) : `${namaOrang(draf.assignees[0] as string)} +${draf.assignees.length - 1}`;

  // Papan ketik judul menutupi lembar pemilih yang dibuka di atasnya.
  const buka = (p: Exclude<Pilih, null>): void => {
    Keyboard.dismiss();
    setPilih(p);
  };

  async function buat(): Promise<void> {
    const t = await f.kirim();
    if (t) {
      f.bersih();
      onDibuat(t);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <SheetInput
          value={draf.title}
          onChangeText={(v) => f.ubah({ title: v })}
          placeholder="Judul tugas"
          maxLength={300}
          returnKeyType="done"
          accessibilityLabel="Judul tugas"
          invalid={Boolean(f.galat.title)}
          autoFocus
        />
        {f.galat.title ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert">
            {f.galat.title}
          </Text>
        ) : null}
      </View>

      <View style={s.chips}>
        <PropChip
          leading={statusDipilih ? <StatusRing kategori={statusDipilih.category} size={22} /> : undefined}
          label={statusDipilih?.name ?? 'Status'}
          aksesLabel={`Status: ${statusDipilih?.name ?? 'belum dimuat'}`}
          onPress={() => buka('status')}
        />
        <PropChip
          leading={draf.priority === 0 ? <Icon name="minus" size={18} /> : <PriorityBars nilai={draf.priority} size={20} />}
          label={draf.priority === 0 ? 'Prioritas' : (LABEL_PRIORITAS[draf.priority] ?? '')}
          aksesLabel={`Prioritas: ${LABEL_PRIORITAS[draf.priority] ?? ''}`}
          putus={draf.priority === 0}
          onPress={() => buka('prioritas')}
        />
        <PropChip
          leading={draf.assignees.length > 0 ? <Avatar name={namaOrang(draf.assignees[0] as string)} size="sm" /> : <Icon name="user" size={20} />}
          label={penanggung}
          aksesLabel={`Penanggung jawab: ${draf.assignees.length === 0 ? 'belum ada' : draf.assignees.map(namaOrang).join(', ')}`}
          putus={draf.assignees.length === 0}
          onPress={() => buka('orang')}
        />
        <PropChip
          leading={<Icon name="calendar" size={20} color={draf.due ? colors.link : colors.text} />}
          label={draf.due ? hariSingkat(draf.due) : 'Tenggat'}
          aksesLabel={draf.due ? `Tenggat: ${tanggal.formatHariTanggal(draf.due)}` : 'Tenggat, belum diatur'}
          aktif={draf.due !== null}
          onPress={() => setPilih('tenggat')}
        />
        <PropChip
          leading={<Icon name="tag" size={20} color={draf.labels.length > 0 ? colors.link : colors.text} />}
          label={labelChip.teks}
          aksesLabel={labelChip.akses}
          aktif={draf.labels.length > 0}
          putus={draf.labels.length === 0}
          onPress={() => setPilih('label')}
        />
      </View>

      <Field label="Workspace" error={f.galat.workspace} hint={f.memuatKonteks ? 'Memuat kolom, label, dan anggota…' : undefined}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setPilih('workspace');
          }}
          scaleTo={1}
          accessibilityRole="button"
          accessibilityLabel={`Workspace: ${draf.workspace?.name ?? 'belum dipilih'}. Ketuk untuk mengganti`}
          style={[s.ws, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
        >
          {draf.workspace ? <UbinWorkspace nama={draf.workspace.name} jenis={draf.workspace.type} size={32} /> : null}
          <Text variant="body" weight={700} style={{ flex: 1 }} numberOfLines={1} tone={draf.workspace ? 'text' : 'subtle'}>
            {draf.workspace ? (draf.workspace.type === 'personal' ? 'Pribadi' : draf.workspace.name) : f.memuat ? 'Memuat…' : 'Pilih workspace'}
          </Text>
          <Icon name="chevron-down" size={20} color={colors.muted} />
        </Pressable>
      </Field>

      {f.galatMuat ? <Banner tone="bad" message={f.galatMuat} actionLabel="Coba lagi" onAction={f.muatUlang} /> : null}
      {f.galatKonteks ? <Banner tone="bad" message={f.galatKonteks} actionLabel="Coba lagi" onAction={f.muatUlangKonteks} /> : null}
      {f.galatUmum ? <Banner tone="bad" message={f.galatUmum} /> : null}

      <View style={s.aksi}>
        <View style={{ flex: 1 }}>
          <Button title="Buat tugas" icon="plus" onPress={() => void buat()} loading={f.mengirim} loadingTitle="Membuat…" disabled={f.memuat} />
        </View>
        <IconButton
          icon="maximize-2"
          label="Buka form lengkap"
          size={52}
          onPress={() => {
            onClose();
            // Pilihan di sheet ikut dibawa; form lengkap menyaringnya lagi terhadap workspace itu.
            router.push({
              pathname: '/tugas/baru',
              params: {
                workspace: draf.workspace?.id ?? '',
                judul: draf.title,
                status: draf.statusId ?? '',
                prioritas: String(draf.priority),
                pj: draf.assignees.join(','),
                label: draf.labels.join(','),
                tenggat: draf.due ?? '',
              },
            });
          }}
        />
      </View>

      <SheetStatus visible={pilih === 'status'} onClose={() => setPilih(null)} judul="Status awal" statuses={f.konteks?.statuses ?? []} nilai={statusDipilih?.id ?? null} onPilih={(id) => f.ubah({ statusId: id })} />
      <SheetPrioritas visible={pilih === 'prioritas'} onClose={() => setPilih(null)} nilai={draf.priority} onPilih={(n) => f.ubah({ priority: n })} />
      <SheetOrang visible={pilih === 'orang'} onClose={() => setPilih(null)} orang={f.anggota} terpilih={draf.assignees} idSaya={user?.id} memuat={f.memuatKonteks} onSimpan={(ids) => f.ubah({ assignees: ids })} />
      <SheetTenggat visible={pilih === 'tenggat'} onClose={() => setPilih(null)} nilai={draf.due} hariIni={hariIni} onPilih={(iso) => f.ubah({ due: iso })} />
      <SheetLabel visible={pilih === 'label'} onClose={() => setPilih(null)} label={f.konteks?.labels ?? []} memuat={f.konteks === null} terpilih={draf.labels} onSimpan={(ids) => f.ubah({ labels: ids })} />
      <SheetWorkspace
        visible={pilih === 'workspace'}
        onClose={() => setPilih(null)}
        kelompok={f.kelompok}
        memuat={f.memuat}
        nilai={draf.workspace?.id ?? null}
        onPilih={f.pilihWorkspace}
        onTerkunci={(_, alasan) => snackbar.show({ message: alasan, variant: 'warn' })}
      />
    </View>
  );
}

export function TugasBaruSheet({ visible, onClose, onDibuat }: { visible: boolean; onClose: () => void; onDibuat: (t: HasilBuat) => void }): React.JSX.Element {
  const [pernah, setPernah] = useState(false);
  if (visible && !pernah) {
    setPernah(true);
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tugas baru" showClose>
      {pernah ? <Isi onDibuat={onDibuat} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ws: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 12 },
  aksi: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
