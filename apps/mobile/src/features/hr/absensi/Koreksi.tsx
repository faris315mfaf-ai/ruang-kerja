/**
 * Koreksi manual HR (mockup 11 › 21): sheet tanggal kerja, jam masuk/pulang
 * (minimal salah satu), alasan wajib 5–500 → dialog konfirmasi → snackbar.
 * Tidak ada antrean offline (data sensitif): offline menonaktifkan Simpan.
 * Server tidak memberi tahu karyawan (kontrak §4.5), jadi teks tidak
 * menjanjikan pemberitahuan. `POST /absensi/koreksi`.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { koreksiManual, type HariKoreksi } from '@/api/hr';
import { InputJam } from '@/features/pengajuan/InputJam';
import { ymdHariIni } from '@/lib/format';
import { BottomSheet, Button, DateInput, Field, Input, Text, useDialog } from '@/ui';

import { hariPendek } from '../format';
import { zonaKantor } from '@/lib/zonaKantor';

export interface TargetKoreksi {
  userId: string;
  name: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}

const MAKS = 500;

function keHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: zonaKantor(), hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  return t.replace('.', ':');
}

export function SheetKoreksi({ target, offline, onClose, onTersimpan }: { target: TargetKoreksi | null; offline: boolean; onClose: () => void; onTersimpan: (pesan: string, hari: HariKoreksi) => void }): React.JSX.Element {
  const dialog = useDialog();
  const [tanggal, setTanggal] = useState('');
  const [masuk, setMasuk] = useState('');
  const [pulang, setPulang] = useState('');
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<Record<string, string | null>>({});
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi awal saat sheet dibuka
      setTanggal(target.workDate);
      setMasuk(keHHMM(target.checkInAt));
      setPulang(keHHMM(target.checkOutAt));
      setAlasan('');
      setGalat({});
    }
  }, [target]);

  async function simpan(): Promise<void> {
    if (!target || sibuk) return;
    const g: Record<string, string | null> = {};
    if (!masuk && !pulang) g.check_in = 'Isi jam masuk, jam pulang, atau keduanya.';
    const teks = alasan.trim();
    if (teks === '') g.reason = 'Alasan koreksi wajib diisi.';
    else if (teks.length < 5) g.reason = 'Tulis alasan koreksi minimal 5 karakter.';
    if (!tanggal) g.work_date = 'Pilih tanggal kerja.';
    setGalat(g);
    if (Object.keys(g).length > 0) return;
    const bagian = [masuk ? `masuk ${masuk.replace(':', '.')}` : null, pulang ? `pulang ${pulang.replace(':', '.')}` : null].filter(Boolean).join(', ');
    const ok = await dialog.confirm({
      title: 'Simpan koreksi?',
      message: `Absensi ${target.name} · ${hariPendek(tanggal)} diubah menjadi ${bagian}. Koreksi tercatat di audit log.`,
      confirmLabel: 'Simpan',
      cancelLabel: 'Batal',
    });
    if (!ok) return;
    setSibuk(true);
    try {
      const hasil = await koreksiManual({ user_id: target.userId, work_date: tanggal, check_in: masuk || null, check_out: pulang || null, reason: teks });
      onTersimpan(hasil.message || 'Koreksi disimpan.', hasil.day);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const e = err.errors;
        const kenal = ['check_in', 'check_out', 'reason', 'work_date'];
        const baru: Record<string, string | null> = {};
        for (const k of kenal) if (e[k]?.[0]) baru[k] = e[k][0];
        if (Object.keys(baru).length === 0) baru.umum = err.firstValidationError ?? err.message;
        setGalat(baru);
      } else if (err instanceof ApiError && err.status === 0) {
        setGalat({ umum: 'Tidak ada koneksi. Koreksi belum tersimpan; tidak ada antrean offline untuk data sensitif.' });
      } else {
        setGalat({ umum: err instanceof ApiError ? err.message : 'Koreksi gagal disimpan.' });
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={target !== null} onClose={onClose} title={target ? `Koreksi absensi · ${target.name}` : 'Koreksi absensi'} scrollable>
      <Text variant="body" tone="muted" style={{ marginTop: -8 }}>
        Koreksi tercatat di audit dan tampil sebagai “manual” di log absensi.
      </Text>
      {offline ? <Text variant="meta" tone="warning">Anda offline. Koreksi disimpan hanya saat tersambung.</Text> : null}
      <DateInput label="Tanggal kerja" value={tanggal} onChange={setTanggal} max={ymdHariIni()} required error={galat.work_date ?? null} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <InputJam label="Jam masuk" judulDialog="Jam masuk" value={masuk} onChange={(v) => { setMasuk(v); setGalat((g) => ({ ...g, check_in: null })); }} error={galat.check_in} clearable />
        </View>
        <View style={{ flex: 1 }}>
          <InputJam label="Jam pulang" judulDialog="Jam pulang" value={pulang} onChange={(v) => { setPulang(v); setGalat((g) => ({ ...g, check_out: null, check_in: null })); }} error={galat.check_out} clearable />
        </View>
      </View>
      <Field label="Alasan" required error={galat.reason ?? null} counter={`${alasan.length} / ${MAKS}`}>
        <Input
          value={alasan}
          onChangeText={(t) => {
            setAlasan(t);
            setGalat((g) => ({ ...g, reason: null }));
          }}
          multiline
          textAlignVertical="top"
          maxLength={MAKS}
          placeholder="Mis. lupa check-out, dikonfirmasi atasan"
          invalid={!!galat.reason}
          accessibilityLabel="Alasan koreksi"
        />
      </Field>
      {galat.umum ? (
        <Text variant="meta" tone="danger" accessibilityRole="alert">
          {galat.umum}
        </Text>
      ) : null}
      <Button title="Simpan koreksi" onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" disabled={offline} disabledReason={offline ? 'Tidak ada koneksi' : undefined} />
    </BottomSheet>
  );
}

