/**
 * Pengumuman baru — judul, isi, penerima (semua / divisi / tim, dibatasi
 * peran lewat GET /pengumuman/audiens), "Tampil sampai" opsional.
 * Mockup: 11-pengumuman-buat (formulir layar penuh menggantikan sheet agar
 * papan ketik Android stabil).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { pilihanAudiens, terbitkanPengumuman, type AudiensPengumuman, type PilihanAudiens } from '@/api/pengumuman';
import { useTheme } from '@/theme';
import { Button, Card, Checkbox, DateInput, ErrorState, Field, Input, Loading, Screen, SegmentedTabs, SubAppBar, Text, errorKindFromStatus, tanggal, useDialog, useSnackbar } from '@/ui';

const LABEL_AUDIENS: Record<AudiensPengumuman, string> = { all: 'Semua karyawan', division: 'Divisi', team: 'Tim' };

interface Galat {
  title?: string;
  body?: string;
  target?: string;
  expires?: string;
}

export default function LayarPengumumanBaru(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [opsi, setOpsi] = useState<PilihanAudiens | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<{ pesan: string; status: number } | null>(null);

  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [audiens, setAudiens] = useState<AudiensPengumuman>('all');
  const [target, setTarget] = useState<string[]>([]);
  const [sampai, setSampai] = useState('');
  const [tersentuh, setTersentuh] = useState({ judul: false, isi: false });
  const [mengirim, setMengirim] = useState(false);
  const [galatServer, setGalatServer] = useState<Galat>({});

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalatMuat(null);
    try {
      const hasil = await pilihanAudiens();
      setOpsi(hasil);
      const pertama = hasil.audiences[0]?.value;
      if (pertama) {
        setAudiens(pertama);
      }
    } catch (err) {
      setGalatMuat({
        pesan: err instanceof ApiError ? (err.status === 403 ? 'Anda tidak berhak membuat pengumuman.' : err.message) : 'Tidak dapat memuat pilihan penerima.',
        status: err instanceof ApiError ? err.status : 0,
      });
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const daftarTarget = audiens === 'division' ? (opsi?.divisions ?? []) : audiens === 'team' ? (opsi?.teams ?? []) : [];
  const judulBersih = judul.trim();
  const isiBersih = isi.trim();
  const galat: Galat = {
    title: galatServer.title ?? (judulBersih === '' ? 'Judul wajib diisi.' : judulBersih.length > 160 ? 'Judul maksimal 160 karakter.' : undefined),
    body: galatServer.body ?? (isiBersih === '' ? 'Isi pengumuman wajib diisi.' : isiBersih.length > 5000 ? 'Isi maksimal 5.000 karakter.' : undefined),
    target: galatServer.target ?? (audiens !== 'all' && target.length === 0 ? (audiens === 'division' ? 'Pilih minimal satu divisi.' : 'Pilih minimal satu tim.') : undefined),
    expires: galatServer.expires,
  };
  const valid = !galat.title && !galat.body && !galat.target;
  const kotor = judulBersih !== '' || isiBersih !== '';

  const gantiAudiens = (nilai: AudiensPengumuman): void => {
    setAudiens(nilai);
    setTarget([]);
    setGalatServer((g) => ({ ...g, target: undefined }));
  };

  const batal = async (): Promise<void> => {
    if (kotor) {
      const ya = await dialog.confirm({ title: 'Buang pengumuman?', message: 'Isi yang sudah Anda tulis akan hilang.', confirmLabel: 'Buang', destructive: true });
      if (!ya) return;
    }
    router.back();
  };

  const terbitkan = async (): Promise<void> => {
    setTersentuh({ judul: true, isi: true });
    if (!valid || mengirim) {
      return;
    }
    setMengirim(true);
    setGalatServer({});
    try {
      const hasil = await terbitkanPengumuman({
        title: judulBersih,
        body: isiBersih,
        audience: audiens,
        target_ids: audiens === 'all' ? undefined : target,
        expires_on: sampai !== '' ? sampai : undefined,
      });
      router.back();
      snackbar.show({
        message: 'Pengumuman diterbitkan',
        variant: 'ok',
        actionLabel: 'Lihat',
        onAction: () => router.push(`/pengumuman/${hasil.id}` as never),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        snackbar.show({ message: 'Tidak ada koneksi. Pengumuman belum terbit.', variant: 'offline' });
      } else if (err instanceof ApiError && err.status === 422) {
        setGalatServer({
          title: err.errors.title?.[0],
          body: err.errors.body?.[0],
          target: err.errors.target_ids?.[0] ?? err.errors.audience?.[0],
          expires: err.errors.expires_on?.[0],
        });
        setTersentuh({ judul: true, isi: true });
        snackbar.show({ message: err.firstValidationError ?? 'Periksa isian pengumuman.', variant: 'bad' });
      } else {
        snackbar.show({ message: err instanceof ApiError ? err.message : 'Pengumuman gagal diterbitkan.', variant: 'bad' });
      }
    } finally {
      setMengirim(false);
    }
  };

  return (
    <Screen
      header={<SubAppBar title="Pengumuman baru" onBack={() => void batal()} />}
      footer={
        opsi ? (
          <>
            <Button title="Batal" variant="quiet" style={{ flex: 1 }} onPress={() => void batal()} />
            <Button
              title="Terbitkan"
              icon="send"
              style={{ flex: 1.6 }}
              loading={mengirim}
              loadingTitle="Menerbitkan…"
              disabled={!valid}
              disabledReason="Lengkapi judul, isi, dan penerima"
              onPress={() => void terbitkan()}
            />
          </>
        ) : undefined
      }
    >
      {memuat ? (
        <Loading rows={4} label="Menyiapkan formulir…" />
      ) : galatMuat || !opsi ? (
        <ErrorState message={galatMuat?.pesan ?? 'Tidak dapat memuat formulir.'} kind={errorKindFromStatus(galatMuat?.status)} onRetry={galatMuat?.status === 403 ? undefined : () => void muat()} />
      ) : (
        <>
          <Field label="Judul" required error={tersentuh.judul ? galat.title : galatServer.title}>
            <Input
              value={judul}
              onChangeText={(t) => {
                setJudul(t);
                setGalatServer((g) => ({ ...g, title: undefined }));
              }}
              onBlur={() => setTersentuh((x) => ({ ...x, judul: true }))}
              placeholder="Contoh: Audit stok gudang"
              maxLength={160}
              invalid={tersentuh.judul && !!galat.title}
              returnKeyType="next"
            />
          </Field>
          <Field label="Isi pengumuman" required error={tersentuh.isi ? galat.body : galatServer.body} counter={`${isi.length} / 5000`}>
            <Input
              value={isi}
              onChangeText={(t) => {
                setIsi(t);
                setGalatServer((g) => ({ ...g, body: undefined }));
              }}
              onBlur={() => setTersentuh((x) => ({ ...x, isi: true }))}
              placeholder="Tulis isi pengumuman"
              multiline
              maxLength={5000}
              textAlignVertical="top"
              invalid={tersentuh.isi && !!galat.body}
            />
          </Field>

          <Field label="Penerima" error={galat.target && (audiens !== 'all') && (tersentuh.judul || tersentuh.isi || galatServer.target) ? galat.target : null}>
            {opsi.audiences.length > 1 ? (
              <SegmentedTabs<AudiensPengumuman>
                value={audiens}
                onChange={gantiAudiens}
                options={opsi.audiences.map((a) => ({ value: a.value, label: LABEL_AUDIENS[a.value] ?? a.label }))}
              />
            ) : (
              <Text variant="body" weight={600}>
                {opsi.audiences[0] ? (LABEL_AUDIENS[opsi.audiences[0].value] ?? opsi.audiences[0].label) : '—'}
              </Text>
            )}
            {audiens !== 'all' ? (
              <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                {daftarTarget.length === 0 ? (
                  <Text variant="meta" style={{ padding: 16 }}>
                    {audiens === 'division' ? 'Tidak ada divisi yang bisa dipilih.' : 'Tidak ada tim yang bisa dipilih.'}
                  </Text>
                ) : (
                  daftarTarget.map((t, i) => (
                    <View key={t.id} style={[{ paddingHorizontal: 16 }, i > 0 ? { borderTopWidth: 1, borderTopColor: colors.divider } : null]}>
                      <Checkbox
                        label={t.name}
                        checked={target.includes(t.id)}
                        onChange={(ya) => {
                          setTarget((lama) => (ya ? [...lama, t.id] : lama.filter((x) => x !== t.id)));
                          setGalatServer((g) => ({ ...g, target: undefined }));
                        }}
                        style={{ minHeight: 56 }}
                      />
                    </View>
                  ))
                )}
              </Card>
            ) : null}
          </Field>

          <DateInput
            label="Tampil sampai (opsional)"
            value={sampai}
            onChange={setSampai}
            min={tanggal.hariIniIso()}
            error={galat.expires}
            hint="Tanggal terakhir pengumuman tampil di beranda."
            placeholder="Tanpa batas"
          />
        </>
      )}
    </Screen>
  );
}
