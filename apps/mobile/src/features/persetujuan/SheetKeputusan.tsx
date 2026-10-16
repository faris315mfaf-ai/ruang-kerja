/**
 * Bottom sheet Tolak / Minta revisi (mockup 22 p1–p3): catatan wajib hingga
 * 1000 karakter, galat inline, tombol penuh. Mengirim langsung ke server —
 * hanya "Setujui" lewat geser/tombol tumpukan yang memakai jendela urungkan.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { putuskan, type HasilKeputusan, type ItemPengajuan } from '@/api/persetujuan';
import { BottomSheet, Button, Field, Input, Text } from '@/ui';

import { namaDepan, periode } from './format';

const MAKS = 1000;

export type JenisSheet = 'tolak' | 'revisi';

export function SheetKeputusan({
  jenis,
  item,
  catatanAwal = '',
  offline = false,
  onClose,
  onSelesai,
  onKonflik,
}: {
  /** null = tertutup. */
  jenis: JenisSheet | null;
  item: Pick<ItemPengajuan, 'id' | 'user' | 'type' | 'start_at' | 'end_at' | 'days' | 'minutes' | 'payload' | 'submitted_at'> | null;
  catatanAwal?: string;
  offline?: boolean;
  onClose: () => void;
  onSelesai: (hasil: HasilKeputusan, jenis: JenisSheet) => void;
  onKonflik: (err: ApiError) => void;
}): React.JSX.Element {
  const [catatan, setCatatan] = useState(catatanAwal);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const terbuka = jenis !== null && item !== null;

  useEffect(() => {
    if (terbuka) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset isian saat sheet dibuka
      setCatatan(catatanAwal);
      setGalat(null);
      setGalatUmum(null);
    }
  }, [terbuka, catatanAwal, jenis]);

  const nama = item ? namaDepan(item.user.name) : '';
  const p = item ? periode(item) : null;
  const sub = item && p ? [item.type.name, [p.utama, p.jam].filter(Boolean).join(' · ')].join(' · ') : '';
  const tolak = jenis === 'tolak';

  async function kirim(): Promise<void> {
    if (!item || !jenis || sibuk) {
      return;
    }
    const teks = catatan.trim();
    if (teks === '') {
      setGalat(tolak ? 'Alasan penolakan wajib diisi.' : 'Catatan wajib diisi saat meminta revisi.');
      return;
    }
    setSibuk(true);
    setGalatUmum(null);
    try {
      const hasil = await putuskan(item.id, jenis, teks);
      onSelesai(hasil, jenis);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onKonflik(err);
      } else if (err instanceof ApiError && err.status === 422) {
        setGalat(err.errors.reason?.[0] ?? err.errors.note?.[0] ?? err.message);
      } else if (err instanceof ApiError && err.status === 0) {
        setGalatUmum('Tidak ada koneksi. Keputusan belum terkirim; coba lagi setelah tersambung.');
      } else {
        setGalatUmum(err instanceof ApiError ? err.message : 'Keputusan gagal dikirim. Coba lagi.');
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={terbuka} onClose={onClose} title={tolak ? `Tolak pengajuan ${nama}?` : `Minta revisi dari ${nama}?`} scrollable>
      <View style={{ gap: 14 }}>
        {sub ? (
          <Text variant="body" tone="muted" style={{ marginTop: -8 }}>
            {sub}
          </Text>
        ) : null}
        <Field
          label={tolak ? 'Catatan untuk pemohon (wajib)' : 'Yang perlu diperbaiki (wajib)'}
          error={galat}
          hint={galat ? null : `Terlihat oleh ${nama} dan HR. Tidak dikirim lewat email atau WhatsApp.`}
          counter={`${catatan.length} / ${MAKS}`}
        >
          <Input
            value={catatan}
            onChangeText={(t) => {
              setCatatan(t);
              setGalat(null);
            }}
            multiline
            textAlignVertical="top"
            maxLength={MAKS}
            placeholder={tolak ? 'Wajib diisi bila menolak' : 'mis. Lampirkan surat tugas dari klien'}
            invalid={galat !== null}
            autoFocus
            accessibilityLabel={tolak ? 'Alasan penolakan' : 'Catatan revisi'}
          />
        </Field>
        {galatUmum ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert">
            {galatUmum}
          </Text>
        ) : null}
        <Button
          title={tolak ? 'Tolak pengajuan' : 'Minta revisi'}
          variant={tolak ? 'danger' : 'primary'}
          onPress={() => void kirim()}
          loading={sibuk}
          loadingTitle="Mengirim…"
          disabled={offline}
          disabledReason={offline ? 'Tidak ada koneksi' : undefined}
        />
      </View>
    </BottomSheet>
  );
}
