/**
 * Pembatalan pengajuan yang sudah disetujui oleh HR/Super Admin (mockup 25,
 * 26): daftar akibat dari `cancel_preview` (saldo dikembalikan, absensi
 * dihapus, tanggal lewat → Alpha, lembur dihitung ulang, koreksi
 * dikembalikan), alasan wajib 10–500 karakter, blocker menonaktifkan tombol
 * (juga 422 `tidak_bisa_dibatalkan` dari server). Dipakai juga oleh modul
 * Persetujuan (impor dari sini).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { batalkanDisetujui, type DetailPengajuan, type EfekBatal } from '@/api/pengajuan';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, Field, Icon, Input, Text } from '@/ui';

import { angkaHari, daftarTanggal, durasiItem, isoDariYmd, judulPeriode, namaDepan, tanggalTanpaTahun } from './format';

function BarisAkibat({ teks }: { teks: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.akibat}>
      <Icon name="circle-check" size={18} color={colors.muted} />
      <Text variant="label" weight={500} style={{ flex: 1, lineHeight: 21 }}>
        {teks}
      </Text>
    </View>
  );
}

/** Ringkasan efek setelah dibatalkan (untuk snackbar/hasil). */
export function ringkasEfek(efek: EfekBatal, detail: DetailPengajuan): string {
  const bagian: string[] = [];
  if (efek.refund_days) {
    bagian.push(`Saldo ${efek.balance_year ?? ''} dikembalikan ${angkaHari(efek.refund_days)} hari`.replace('  ', ' '));
  }
  if (efek.removed_dates.length > 0) {
    bagian.push(`catatan absensi ${daftarTanggal(efek.removed_dates)} dihapus`);
  }
  if (efek.reclosed_dates.length > 0) {
    bagian.push(`${daftarTanggal(efek.reclosed_dates)} dihitung ulang`);
  }
  if (efek.overtime_date) {
    bagian.push(`lembur ${tanggalTanpaTahun(isoDariYmd(efek.overtime_date))} dihitung ulang`);
  }
  if (efek.correction_date) {
    bagian.push(`koreksi ${tanggalTanpaTahun(isoDariYmd(efek.correction_date))} dikembalikan`);
  }
  const awal = `Pengajuan dibatalkan. ${namaDepan(detail.user.name)} dan penyetuju diberi tahu.`;
  return bagian.length > 0 ? `${awal} ${bagian.join(', ')}.` : awal;
}

export function BatalDisetujuiSheet({
  detail,
  visible,
  onClose,
  onSelesai,
}: {
  detail: DetailPengajuan;
  visible: boolean;
  onClose: () => void;
  onSelesai: (hasil: { request: DetailPengajuan; effects: EfekBatal }) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [blockerServer, setBlockerServer] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const p = detail.cancel_preview;
  const min = p?.reason_min ?? 10;
  const maks = p?.reason_max ?? 500;
  const blocker = blockerServer ?? p?.blocker ?? p?.attendance.blocker ?? null;
  const nama = namaDepan(detail.user.name);

  const akibat: string[] = [];
  if (p?.refund_days) {
    akibat.push(`Saldo ${detail.type.name.toLowerCase()} ${p.balance_year ?? ''} dikembalikan ${angkaHari(p.refund_days)} hari.`.replace('  ', ' '));
  }
  if (p && p.attendance.removed_dates.length > 0) {
    akibat.push(`Catatan absensi ${daftarTanggal(p.attendance.removed_dates)} dihapus.`);
  }
  if (p && p.attendance.unlinked_dates.length > 0) {
    akibat.push(`Hari ${daftarTanggal(p.attendance.unlinked_dates)} yang tetap masuk dilepas dari pengajuan (status Hadir/Terlambat).`);
  }
  if (p?.attendance.overtime_date) {
    akibat.push(`Lembur ${tanggalTanpaTahun(isoDariYmd(p.attendance.overtime_date))} dihitung ulang.`);
  }
  if (p?.attendance.correction_date && !blocker) {
    akibat.push(`Koreksi absensi ${tanggalTanpaTahun(isoDariYmd(p.attendance.correction_date))} dikembalikan ke jam sebelumnya.`);
  }
  akibat.push(`${nama} dan penyetuju diberi tahu. Alasan Anda hanya tampil di aplikasi.`);

  const kirim = async (): Promise<void> => {
    const teks = alasan.trim();
    if (teks.length < min) {
      setGalat(`Tulis alasan pembatalan minimal ${min} karakter.`);
      return;
    }
    setMengirim(true);
    setGalat(null);
    try {
      const hasil = await batalkanDisetujui(detail.id, teks);
      setAlasan('');
      onSelesai(hasil);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'tidak_bisa_dibatalkan') {
        setBlockerServer(err.message);
      } else if (err instanceof ApiError && err.status === 422) {
        setGalat(err.errors.reason?.[0] ?? err.firstValidationError ?? err.message);
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Pembatalan gagal. Coba lagi.');
      }
    } finally {
      setMengirim(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Batalkan pengajuan yang sudah disetujui?" scrollable>
      <View style={{ gap: 14 }}>
        <Text variant="meta">
          {[detail.number, detail.user.name, `${detail.type.name}, ${judulPeriode(detail)}`, durasiItem(detail)].filter(Boolean).join(' · ')}
        </Text>
        {blocker ? (
          <>
            <View style={[s.kotak, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
              <Icon name="triangle-alert" size={20} color={colors.danger} />
              <Text variant="label" weight={500} style={{ flex: 1, color: colors.danger, lineHeight: 21 }}>
                {blocker}
              </Text>
            </View>
            <Text variant="meta">Ubah absensi hari itu lewat Absensi › Koreksi, lalu tutup pengajuan ini bila perlu.</Text>
          </>
        ) : (
          <>
            <View style={{ gap: 10 }}>
              {akibat.map((a) => (
                <BarisAkibat key={a} teks={a} />
              ))}
            </View>
            {p && p.past_dates.length > 0 ? (
              <View style={[s.kotak, { backgroundColor: colors.warningSoft }]}>
                <Icon name="triangle-alert" size={20} color={colors.warning} />
                <Text variant="label" weight={500} style={{ flex: 1, color: colors.warning, lineHeight: 21 }}>
                  {daftarTanggal(p.past_dates)} sudah lewat. Absensinya dihitung ulang sekarang: tanpa check-in, hari itu menjadi Alpha.
                </Text>
              </View>
            ) : null}
            <Field label="Alasan pembatalan" error={galat} hint={`Wajib, minimal ${min} karakter. Terlihat oleh ${nama}.`} counter={`${alasan.length}/${maks}`}>
              <Input
                value={alasan}
                onChangeText={(t) => {
                  setAlasan(t);
                  if (galat) {
                    setGalat(null);
                  }
                }}
                multiline
                textAlignVertical="top"
                maxLength={maks}
                placeholder="Mis. proyek darurat, cuti dijadwalkan ulang bersama karyawan."
                invalid={!!galat}
                accessibilityLabel="Alasan pembatalan"
              />
            </Field>
          </>
        )}
        <Button title="Ya, batalkan pengajuan" variant="danger" loading={mengirim} disabled={!!blocker} disabledReason={blocker ?? undefined} onPress={() => void kirim()} />
        <Button title="Kembali" variant="quiet" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  akibat: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  kotak: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg },
});
