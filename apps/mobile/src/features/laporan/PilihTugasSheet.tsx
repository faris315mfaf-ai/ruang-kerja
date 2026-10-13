/**
 * Sheet "Pilih tugas" (mockup 29-1…29-4): saran Hari ini + ditugaskan, cari
 * tugas lain yang terlihat (`GET /laporan/cari-tugas`, min. 2 huruf), hasil
 * kosong → "Tambah di luar tugas", memuat.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { cariTugasLaporan, type OpsiTugas } from '@/api/laporan';
import { useTheme } from '@/theme';
import { BottomSheet, Button, EmptyState, Icon, Pressable, SearchInput, Skeleton, Text } from '@/ui';

import { tanggalSingkat } from './format';

function metaOpsi(o: OpsiTugas, hariIni: string): string {
  const bagian = [o.key, o.workspace.name, o.status.name];
  if (o.due_date) {
    bagian.push(o.due_date === hariIni ? 'Tenggat hari ini' : `Tenggat ${tanggalSingkat(o.due_date).split(' ')[0]}${o.due_date < hariIni ? ' (lewat)' : ''}`);
  }
  return bagian.join(' · ');
}

function BarisOpsi({ o, ditambahkan, penuh, hariIni, onTambah }: { o: OpsiTugas; ditambahkan: boolean; penuh: boolean; hariIni: string; onTambah: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.baris, { borderTopColor: colors.divider }]}>
      <View style={{ flex: 1, gap: 2, opacity: ditambahkan ? 0.55 : 1 }}>
        <Text variant="title" numberOfLines={2}>
          {o.title}
        </Text>
        <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={2}>
          {metaOpsi(o, hariIni)}
        </Text>
      </View>
      {ditambahkan ? (
        <View style={[s.pil, { backgroundColor: colors.successSoft }]}>
          <Text variant="label" tone="success" style={{ fontSize: 14 }}>
            Ditambahkan
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={onTambah}
          disabled={penuh}
          accessibilityRole="button"
          accessibilityLabel={`Tambah ${o.key} ${o.title}`}
          accessibilityState={{ disabled: penuh }}
          style={[s.pil, { backgroundColor: colors.linkSoft, minHeight: 44, paddingHorizontal: 16, opacity: penuh ? 0.5 : 1 }]}
        >
          <Icon name="plus" size={18} color={colors.link} />
          <Text variant="label" tone="link">
            Tambah
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export interface PilihTugasSheetProps {
  visible: boolean;
  onClose: () => void;
  saran: OpsiTugas[];
  sudahDipilih: Set<string>;
  penuh: boolean;
  hariIni: string;
  onTambah: (o: OpsiTugas) => void;
  onDiLuarTugas: () => void;
}

export function PilihTugasSheet({ visible, onClose, saran, sudahDipilih, penuh, hariIni, onTambah, onDiLuarTugas }: PilihTugasSheetProps): React.JSX.Element {
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<OpsiTugas[] | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const urut = useRef(0);

  useEffect(() => {
    if (!visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat sheet ditutup
      setQ('');
      setHasil(null);
      setGalat(null);
    }
  }, [visible]);

  useEffect(() => {
    const kata = q.trim();
    if (kata.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kembali ke saran saat kata pencarian terlalu pendek
      setHasil(null);
      setMemuat(false);
      setGalat(null);
      return undefined;
    }
    const nomor = ++urut.current;
    setMemuat(true);
    const t = setTimeout(() => {
      cariTugasLaporan(kata)
        .then((r) => {
          if (nomor !== urut.current) return;
          setHasil(r);
          setGalat(null);
        })
        .catch((err: unknown) => {
          if (nomor !== urut.current) return;
          setGalat(err instanceof ApiError && err.status === 0 ? 'Tidak ada koneksi. Pencarian butuh internet.' : err instanceof ApiError ? err.message : 'Pencarian gagal.');
        })
        .finally(() => {
          if (nomor === urut.current) setMemuat(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const hariIniSaran = saran.filter((o) => o.planned_today);
  const lainSaran = saran.filter((o) => !o.planned_today);

  const daftar = (judul: string, isi: OpsiTugas[]): React.JSX.Element | null =>
    isi.length === 0 ? null : (
      <View>
        <Text variant="overline" tone="muted" style={{ marginBottom: 8, marginTop: 4 }}>
          {judul}
        </Text>
        {isi.map((o) => (
          <BarisOpsi key={o.id} o={o} hariIni={hariIni} ditambahkan={sudahDipilih.has(o.id)} penuh={penuh} onTambah={() => onTambah(o)} />
        ))}
      </View>
    );

  let isi: React.ReactNode;
  if (q.trim().length >= 2) {
    if (memuat && hasil === null) {
      isi = (
        <View style={{ gap: 14, paddingTop: 8 }} accessibilityLabel="Mencari tugas…">
          <Skeleton height={20} width="80%" />
          <Skeleton height={14} width="60%" />
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} width="50%" />
        </View>
      );
    } else if (galat) {
      isi = (
        <Text variant="meta" tone="danger" style={{ paddingVertical: 12 }}>
          {galat}
        </Text>
      );
    } else if (hasil && hasil.length === 0) {
      isi = (
        <EmptyState
          icon="search"
          title="Tidak ada tugas yang cocok"
          description="Hanya tugas yang bisa Anda lihat. Pekerjaan lain bisa dicatat sebagai “Di luar tugas”."
          actionLabel="Tambah di luar tugas"
          onAction={onDiLuarTugas}
          variant="plain"
        />
      );
    } else {
      isi = (
        <View>
          {(hasil ?? []).map((o) => (
            <BarisOpsi key={o.id} o={o} hariIni={hariIni} ditambahkan={sudahDipilih.has(o.id)} penuh={penuh} onTambah={() => onTambah(o)} />
          ))}
        </View>
      );
    }
  } else if (saran.length === 0) {
    isi = (
      <EmptyState
        icon="list-checks"
        title="Belum ada saran tugas"
        description="Ketik judul atau kode tugas untuk mencari, atau catat sebagai pekerjaan di luar tugas."
        actionLabel="Tambah di luar tugas"
        onAction={onDiLuarTugas}
        variant="plain"
      />
    );
  } else {
    isi = (
      <View style={{ gap: 12 }}>
        {daftar('Saran · Hari ini', hariIniSaran)}
        {daftar('Ditugaskan ke saya', lainSaran)}
      </View>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih tugas" showClose scrollable snapPoints={['88%']}>
      <SearchInput value={q} onChangeText={setQ} placeholder="Judul atau kode, mis. OPS-12" />
      {penuh ? (
        <Text variant="meta" tone="warning">
          Batas jumlah pekerjaan dalam satu laporan sudah tercapai.
        </Text>
      ) : null}
      {isi}
      <Button title="Tutup" variant="quiet" onPress={onClose} />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999 },
});
