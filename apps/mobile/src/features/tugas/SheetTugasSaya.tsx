/** Sheet & dialog layar "Tugas saya": filter, kelompokkan, tampilan tersimpan, rencanakan, menu konteks. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { KategoriStatus, LajurRencana, TampilanTersimpan } from '@/api/tugas';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, Chip, Dialog, Icon, Input, Pressable, SheetAction, Switch, Text, type IconName } from '@/ui';

import { FILTER_KOSONG, LABEL_TENGGAT, jumlahFilter, type FilterTugas, type KelompokPer, type TenggatFilter } from './filter';
import { LABEL_KATEGORI, LABEL_LAJUR, LABEL_PRIORITAS, hariSingkat, akhirPekan } from './util';

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="overline" tone="muted">
        {judul.toUpperCase()}
      </Text>
      <View style={s.chips}>{children}</View>
    </View>
  );
}

function ganti<T>(daftar: T[], nilai: T): T[] {
  return daftar.includes(nilai) ? daftar.filter((x) => x !== nilai) : [...daftar, nilai];
}

export function SheetFilter({
  visible,
  onClose,
  filter,
  onTerapkan,
  orang,
  label,
  workspace,
}: {
  visible: boolean;
  onClose: () => void;
  filter: FilterTugas;
  onTerapkan: (f: FilterTugas) => void;
  orang: { id: string; name: string }[];
  label: { id: string; name: string }[];
  workspace: string[];
}): React.JSX.Element {
  const [draf, setDraf] = useState<FilterTugas>(filter);
  const [terakhir, setTerakhir] = useState(visible);
  if (visible !== terakhir) {
    setTerakhir(visible);
    if (visible) {
      setDraf(filter);
    }
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filter tugas" showClose scrollable>
      <Bagian judul="Penanggung jawab">
        <Chip label="Saya" selected={draf.penanggung === 'saya'} onPress={() => setDraf({ ...draf, penanggung: draf.penanggung === 'saya' ? null : 'saya' })} />
        {orang.map((o) => (
          <Chip key={o.id} label={o.name} selected={draf.penanggung === o.id} onPress={() => setDraf({ ...draf, penanggung: draf.penanggung === o.id ? null : o.id })} />
        ))}
      </Bagian>
      <Bagian judul="Prioritas">
        {[1, 2, 3, 4, 0].map((p) => (
          <Chip key={p} label={p === 1 ? '! Urgent' : (LABEL_PRIORITAS[p] ?? '')} selected={draf.prioritas.includes(p)} onPress={() => setDraf({ ...draf, prioritas: ganti(draf.prioritas, p) })} />
        ))}
      </Bagian>
      <Bagian judul="Status">
        {(['backlog', 'todo', 'in_progress', 'review', 'done', 'canceled'] as KategoriStatus[]).map((k) => (
          <Chip key={k} label={LABEL_KATEGORI[k]} selected={draf.status.includes(k)} onPress={() => setDraf({ ...draf, status: ganti(draf.status, k) })} />
        ))}
      </Bagian>
      <Bagian judul="Tenggat">
        {(['overdue', 'today', 'week', 'none'] as TenggatFilter[]).map((t) => (
          <Chip key={t} label={LABEL_TENGGAT[t]} selected={draf.tenggat === t} onPress={() => setDraf({ ...draf, tenggat: draf.tenggat === t ? null : t })} />
        ))}
      </Bagian>
      {workspace.length > 1 ? (
        <Bagian judul="Workspace">
          {workspace.map((w) => (
            <Chip key={w} label={w} selected={draf.workspace.includes(w)} onPress={() => setDraf({ ...draf, workspace: ganti(draf.workspace, w) })} />
          ))}
        </Bagian>
      ) : null}
      {label.length > 0 ? (
        <Bagian judul="Label">
          {label.map((l) => (
            <Chip key={l.id} label={l.name} selected={draf.label.includes(l.id)} onPress={() => setDraf({ ...draf, label: ganti(draf.label, l.id) })} />
          ))}
        </Bagian>
      ) : null}
      <View style={s.aksi}>
        <View style={{ flex: 1 }}>
          <Button title="Hapus filter" variant="outline" disabled={jumlahFilter(draf) === 0} onPress={() => setDraf({ ...FILTER_KOSONG, q: draf.q })} />
        </View>
        <View style={{ flex: 1.4 }}>
          <Button
            title="Terapkan"
            onPress={() => {
              onTerapkan(draf);
              onClose();
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const KELOMPOK: { nilai: KelompokPer; label: string; deskripsi?: string; icon: IconName }[] = [
  { nilai: 'tenggat', label: 'Tenggat', deskripsi: 'Terlambat · Hari ini · Minggu ini · Nanti', icon: 'calendar' },
  { nilai: 'workspace', label: 'Workspace', icon: 'layout-grid' },
  { nilai: 'prioritas', label: 'Prioritas', icon: 'signal-high' },
  { nilai: 'status', label: 'Status', icon: 'circle-dot' },
];

export function SheetKelompok({
  visible,
  onClose,
  nilai,
  onPilih,
  tampilSelesai,
  onTampilSelesai,
  onRencana,
  onTampilan,
}: {
  visible: boolean;
  onClose: () => void;
  nilai: KelompokPer;
  onPilih: (k: KelompokPer) => void;
  tampilSelesai: boolean;
  onTampilSelesai: (v: boolean) => void;
  onRencana: () => void;
  onTampilan: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Kelompokkan menurut" showClose>
      {KELOMPOK.map((k) => {
        const aktif = nilai === k.nilai;
        return (
          <Pressable
            key={k.nilai}
            scaleTo={1}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
            accessibilityLabel={k.label}
            onPress={() => {
              onPilih(k.nilai);
              onClose();
            }}
            style={[s.baris, aktif ? { backgroundColor: colors.linkSoft } : null]}
          >
            <Icon name={k.icon} size={22} color={aktif ? colors.link : colors.text} />
            <View style={{ flex: 1 }}>
              <Text variant="title" tone={aktif ? 'link' : 'text'}>
                {k.label}
              </Text>
              {k.deskripsi ? <Text variant="meta">{k.deskripsi}</Text> : null}
            </View>
            {aktif ? <Icon name="check" size={22} color={colors.link} /> : null}
          </Pressable>
        );
      })}
      <SheetAction
        icon="sun"
        label="Rencana saya"
        description="Susun hari Anda: Hari ini · Minggu ini · Nanti"
        onPress={() => {
          onRencana();
          onClose();
        }}
      />
      <SheetAction
        icon="bookmark"
        label="Tampilan tersimpan"
        description="Filter yang sering dipakai"
        onPress={() => {
          onClose();
          setTimeout(onTampilan, 250);
        }}
      />
      <View style={[s.garis, { backgroundColor: colors.divider }]} />
      <View style={s.baris}>
        <Icon name="eye" size={22} />
        <View style={{ flex: 1 }}>
          <Text variant="title">Tampilkan tugas selesai minggu ini</Text>
        </View>
        <Switch value={tampilSelesai} onValueChange={onTampilSelesai} label="Tampilkan tugas selesai minggu ini" />
      </View>
    </BottomSheet>
  );
}

export function SheetTampilan({
  visible,
  onClose,
  tampilan,
  aktifId,
  bisaSimpan,
  onPakai,
  onSimpan,
  onHapus,
  memuat,
}: {
  visible: boolean;
  onClose: () => void;
  tampilan: TampilanTersimpan[];
  aktifId: string | null;
  bisaSimpan: boolean;
  onPakai: (t: TampilanTersimpan) => void;
  onSimpan: () => void;
  onHapus: (t: TampilanTersimpan) => void;
  memuat: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tampilan tersimpan" showClose scrollable>
      <Text variant="meta">Filter lintas workspace, hanya terlihat oleh Anda</Text>
      {memuat ? <Text variant="body" tone="muted">Memuat…</Text> : null}
      {!memuat && tampilan.length === 0 ? <Text variant="body" tone="muted">Belum ada tampilan tersimpan.</Text> : null}
      {tampilan.map((t) => {
        const aktif = aktifId === t.id;
        const n = jumlahFilter({ ...FILTER_KOSONG, q: t.filters.q ?? '', workspace: t.filters.workspaces ?? [], prioritas: t.filters.priorities ?? [], status: t.filters.statuses ?? [], label: t.filters.labels ?? [], penanggung: t.filters.assignees?.[0] ?? null, tenggat: t.filters.due ?? null });
        return (
          <View key={t.id} style={[s.baris, aktif ? { backgroundColor: colors.linkSoft } : null]}>
            <Pressable
              scaleTo={1}
              accessibilityRole="button"
              accessibilityLabel={`Pakai tampilan ${t.name}`}
              onPress={() => {
                onPakai(t);
                onClose();
              }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Icon name="bookmark" size={22} color={aktif ? colors.link : colors.text} />
              <View style={{ flex: 1 }}>
                <Text variant="title" tone={aktif ? 'link' : 'text'}>
                  {t.name}
                </Text>
                <Text variant="meta">{n} filter</Text>
              </View>
              {aktif ? <Icon name="check" size={22} color={colors.link} /> : null}
            </Pressable>
            <Pressable scaleTo={1} accessibilityRole="button" accessibilityLabel={`Hapus tampilan ${t.name}`} onPress={() => onHapus(t)} hitSlop={8} style={s.ikonKecil}>
              <Icon name="trash-2" size={20} color={colors.muted} />
            </Pressable>
          </View>
        );
      })}
      <View style={[s.garis, { backgroundColor: colors.divider }]} />
      <SheetAction
        icon="bookmark-plus"
        label="Simpan filter saat ini…"
        description={bisaSimpan ? undefined : 'Atur filter lebih dulu'}
        onPress={() => {
          if (bisaSimpan) {
            onClose();
            onSimpan();
          }
        }}
      />
    </BottomSheet>
  );
}

/** Dialog nama tampilan (Modal biasa — isian teks aman dari papan ketik). */
export function DialogNamaTampilan({ visible, onBatal, onSimpan, memproses, galat }: { visible: boolean; onBatal: () => void; onSimpan: (nama: string) => void; memproses: boolean; galat: string | null }): React.JSX.Element {
  const [nama, setNama] = useState('');
  return (
    <Dialog
      visible={visible}
      title="Simpan tampilan"
      message="Beri nama agar mudah dipakai lagi."
      onClose={onBatal}
      actions={[
        { label: 'Batal', onPress: onBatal, variant: 'quiet' },
        { label: 'Simpan', onPress: () => onSimpan(nama.trim()), variant: 'tonal', disabled: nama.trim() === '' || memproses, loading: memproses },
      ]}
    >
      <DialogIsian nilai={nama} onChange={setNama} galat={galat} />
    </Dialog>
  );
}

function DialogIsian({ nilai, onChange, galat }: { nilai: string; onChange: (v: string) => void; galat: string | null }): React.JSX.Element {
  return (
    <View style={{ gap: 6 }}>
      <Input value={nilai} onChangeText={onChange} placeholder="mis. Urgent & terlambat" maxLength={60} invalid={galat !== null} accessibilityLabel="Nama tampilan" autoFocus />
      {galat ? (
        <Text variant="meta" tone="danger">
          {galat}
        </Text>
      ) : null}
    </View>
  );
}

export function SheetRencanakan({
  visible,
  onClose,
  judul,
  subjudul,
  lajur,
  hariIni,
  onPilih,
}: {
  visible: boolean;
  onClose: () => void;
  judul?: string;
  subjudul: string;
  /** Lajur terpilih saat ini (null = otomatis). */
  lajur: LajurRencana | null;
  hariIni: string;
  onPilih: (l: LajurRencana | null) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const opsi: { l: LajurRencana; icon: IconName; deskripsi: string }[] = [
    { l: 'today', icon: 'sun', deskripsi: hariSingkat(hariIni) },
    { l: 'week', icon: 'calendar', deskripsi: `sampai ${hariSingkat(akhirPekan(hariIni))}` },
    { l: 'later', icon: 'inbox', deskripsi: '' },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose} title={judul ?? 'Rencanakan tugas'} showClose>
      <Text variant="meta">{subjudul}</Text>
      {opsi.map((o) => {
        const aktif = lajur === o.l;
        return (
          <Pressable
            key={o.l}
            scaleTo={1}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
            accessibilityLabel={LABEL_LAJUR[o.l]}
            onPress={() => {
              onPilih(o.l);
              onClose();
            }}
            style={[s.baris, aktif ? { backgroundColor: colors.linkSoft } : null]}
          >
            <Icon name={o.icon} size={22} color={aktif ? colors.link : colors.text} />
            <View style={{ flex: 1 }}>
              <Text variant="title" tone={aktif ? 'link' : 'text'}>
                {LABEL_LAJUR[o.l]}
              </Text>
              {o.deskripsi ? <Text variant="meta">{o.deskripsi}</Text> : null}
            </View>
            {aktif ? <Icon name="check" size={22} color={colors.link} /> : null}
          </Pressable>
        );
      })}
      <View style={[s.garis, { backgroundColor: colors.divider }]} />
      <SheetAction
        icon="rotate-ccw"
        label="Kembali otomatis"
        description="ikuti tenggat tugas"
        onPress={() => {
          onPilih(null);
          onClose();
        }}
      />
      <Text variant="meta">Rencana pribadi: tidak mengubah tugas dan tidak terlihat orang lain.</Text>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aksi: { flexDirection: 'row', gap: 12, marginTop: 4 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.lg },
  garis: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  ikonKecil: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
