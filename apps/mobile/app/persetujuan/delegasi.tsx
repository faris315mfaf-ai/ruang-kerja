/**
 * Delegasi persetujuan — mockup 04: 23 (daftar kosong, form, pemilih rekan,
 * galat tanggal) dan 24 (hentikan, banner aktif, penerima "Mewakili",
 * snackbar tersimpan). Layar penuh (bukan sheet) supaya kalender DateInput
 * dan pemilih rekan tidak bertumpuk di atas sheet lain.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatDelegasi, daftarDelegasi, hentikanDelegasi, ubahDelegasi, type DaftarDelegasi, type Delegasi, type OrangPilihan } from '@/api/persetujuan';
import { tanggalNumerikBerhari } from '@/features/persetujuan/format';
import { PemilihRekan } from '@/features/persetujuan/PemilihRekan';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme } from '@/theme';
import { Avatar, Badge, Banner, Button, DateInput, ErrorState, Field, IconButton, Input, Loading, Screen, SectionHeader, SelectField, SubAppBar, Text, errorKindFromStatus, tanggal, useDialog, useSnackbar } from '@/ui';

interface Isian {
  editId: string | null;
  rekan: { id: string; name: string } | null;
  mulai: string;
  selesai: string;
  keterangan: string;
}

type Galat = Partial<Record<'delegate_id' | 'starts_on' | 'ends_on' | 'reason' | 'umum', string>>;

function isianKosong(hariIni: string): Isian {
  return { editId: null, rekan: null, mulai: hariIni, selesai: hariIni, keterangan: '' };
}

function KartuDelegasi({ d, peran, nonaktif, onUbah, onHentikan }: { d: Delegasi; peran: 'saya' | 'diterima'; nonaktif: boolean; onUbah?: () => void; onHentikan?: () => void }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const orang = peran === 'saya' ? d.delegate : d.delegator;
  const rentang = `${tanggalNumerikBerhari(d.starts_on)} – ${tanggalNumerikBerhari(d.ends_on)}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, boxShadow: shadows.card }}>
      <Avatar name={orang.name} size="md" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title" numberOfLines={1}>
          {peran === 'saya' ? orang.name : `Mewakili ${orang.name}`}
        </Text>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {[rentang, d.reason].filter(Boolean).join(' · ')}
        </Text>
        <Badge tone={d.active ? 'success' : 'neutral'}>{d.active ? 'Aktif' : 'Belum aktif'}</Badge>
      </View>
      {onUbah ? <IconButton icon="square-pen" label={`Ubah delegasi ke ${orang.name}`} variant="ghost" onPress={onUbah} disabled={nonaktif} /> : null}
      {onHentikan ? <IconButton icon="x" label={`Hentikan delegasi ke ${orang.name}`} variant="ghost" onPress={onHentikan} disabled={nonaktif} /> : null}
    </View>
  );
}

export default function LayarDelegasi(): React.JSX.Element {
  const { user } = useSession();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [data, setData] = useState<DaftarDelegasi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<{ pesan: string; status: number | null } | null>(null);
  const [offline, setOffline] = useState(false);
  const [isian, setIsian] = useState<Isian>(() => isianKosong(tanggal.hariIniIso()));
  const [galat, setGalat] = useState<Galat>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [pemilih, setPemilih] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      const d = await daftarDelegasi();
      setData(d);
      setGalatMuat(null);
      setOffline(false);
      setIsian((lama) => (lama.editId === null && lama.rekan === null ? isianKosong(d.today) : lama));
    } catch (err) {
      const status = err instanceof ApiError ? err.status : null;
      setOffline(status === 0);
      setGalatMuat({ pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat delegasi.', status });
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const hariIni = data?.today ?? tanggal.hariIniIso();

  const ubah = (d: Delegasi): void => {
    setIsian({ editId: d.id, rekan: { id: d.delegate.id, name: d.delegate.name }, mulai: d.starts_on, selesai: d.ends_on, keterangan: d.reason ?? '' });
    setGalat({});
  };

  const hentikan = async (d: Delegasi): Promise<void> => {
    const ya = await dialog.confirm({
      title: 'Hentikan delegasi?',
      message: `Pengajuan baru akan kembali menunggu Anda, bukan ${d.delegate.name}. Langkah yang sudah dialihkan kembali ke Anda.`,
      confirmLabel: 'Hentikan',
      destructive: true,
    });
    if (!ya) {
      return;
    }
    try {
      await hentikanDelegasi(d.id);
      snackbar.show({ message: 'Delegasi dihentikan.', variant: 'ok' });
      if (isian.editId === d.id) {
        setIsian(isianKosong(hariIni));
      }
      void muat();
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Delegasi gagal dihentikan.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
    }
  };

  const simpan = async (): Promise<void> => {
    const g: Galat = {};
    if (!isian.rekan) {
      g.delegate_id = 'Pilih rekan sebagai delegasi.';
    }
    if (!isian.mulai) {
      g.starts_on = 'Isi tanggal mulai.';
    }
    if (!isian.selesai) {
      g.ends_on = 'Isi tanggal selesai.';
    } else if (isian.mulai && isian.selesai < isian.mulai) {
      g.ends_on = 'Tanggal selesai harus sama atau setelah tanggal mulai.';
    }
    setGalat(g);
    if (Object.keys(g).length > 0 || !isian.rekan) {
      return;
    }
    setMenyimpan(true);
    const body = { delegate_id: isian.rekan.id, starts_on: isian.mulai, ends_on: isian.selesai, reason: isian.keterangan.trim() === '' ? null : isian.keterangan.trim() };
    try {
      if (isian.editId) {
        await ubahDelegasi(isian.editId, body);
      } else {
        await buatDelegasi(body);
      }
      snackbar.show({ message: `Delegasi ke ${isian.rekan.name} tersimpan sampai ${tanggalNumerikBerhari(isian.selesai)}.`, variant: 'ok' });
      setIsian(isianKosong(hariIni));
      setGalat({});
      void muat();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const e = err.errors;
        const pertama = (k: string): string | undefined => e[k]?.[0];
        const baru: Galat = { delegate_id: pertama('delegate_id'), starts_on: pertama('starts_on'), ends_on: pertama('ends_on'), reason: pertama('reason') };
        if (!baru.delegate_id && !baru.starts_on && !baru.ends_on && !baru.reason) {
          baru.umum = err.firstValidationError ?? err.message;
        }
        setGalat(baru);
      } else if (err instanceof ApiError && err.status === 0) {
        setOffline(true);
        setGalat({ umum: 'Tidak ada koneksi. Delegasi belum tersimpan.' });
      } else {
        setGalat({ umum: err instanceof ApiError ? err.message : 'Delegasi gagal disimpan.' });
      }
    } finally {
      setMenyimpan(false);
    }
  };

  const kecualikan = [user?.id, user?.manager?.id].filter((x): x is string => typeof x === 'string');

  let isi: React.ReactNode;
  if (memuat && !data) {
    isi = <Loading rows={4} label="Memuat delegasi…" />;
  } else if (!data && galatMuat) {
    isi = <ErrorState message={galatMuat.pesan} kind={errorKindFromStatus(galatMuat.status)} onRetry={() => void muat()} />;
  } else if (data) {
    const mengubah = isian.editId !== null;
    isi = (
      <>
        <Text variant="body" tone="muted">
          Selama periode ini, pengajuan yang menunggu Anda diteruskan ke rekan yang ditunjuk.
        </Text>
        {offline ? <Banner tone="warn" icon="cloud-off" title="Offline." message="Menyimpan dan menghentikan delegasi dimatikan sampai tersambung." actionLabel="Coba lagi" onAction={() => void muat()} /> : null}
        {data.mine.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title="Delegasi Anda" />
            {data.mine.map((d) => (
              <KartuDelegasi key={d.id} d={d} peran="saya" nonaktif={offline} onUbah={() => ubah(d)} onHentikan={() => void hentikan(d)} />
            ))}
          </View>
        ) : (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Pengajuan yang menunggu Anda tidak dialihkan selama Anda tidak mendelegasikan.
          </Text>
        )}
        {data.received.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title="Anda mewakili" />
            {data.received.map((d) => (
              <KartuDelegasi key={d.id} d={d} peran="diterima" nonaktif={offline} />
            ))}
            <Text variant="meta" style={{ fontSize: 14 }}>
              Keputusan Anda tercatat atas nama Anda, atas delegasi pemberi.
            </Text>
          </View>
        ) : null}
        <View style={{ gap: 14 }}>
          <SectionHeader title={mengubah ? 'Ubah delegasi' : 'Delegasi baru'} />
          <Field label="Delegasikan ke" error={galat.delegate_id}>
            <SelectField value={isian.rekan?.name ?? null} placeholder="Pilih rekan" onPress={() => setPemilih(true)} invalid={galat.delegate_id !== undefined} accessibilityLabel="Delegasikan ke" />
          </Field>
          <DateInput
            label="Mulai"
            value={isian.mulai}
            min={mengubah ? undefined : hariIni}
            required
            error={galat.starts_on}
            onChange={(v) => {
              setIsian((l) => ({ ...l, mulai: v, selesai: l.selesai && l.selesai < v ? v : l.selesai }));
              setGalat((g) => ({ ...g, starts_on: undefined }));
            }}
          />
          <DateInput
            label="Selesai"
            value={isian.selesai}
            required
            error={galat.ends_on}
            onChange={(v) => {
              setIsian((l) => ({ ...l, selesai: v }));
              setGalat((g) => ({ ...g, ends_on: undefined }));
            }}
          />
          <Field label="Keterangan (opsional)" error={galat.reason} counter={`${isian.keterangan.length} / 255`}>
            <Input value={isian.keterangan} onChangeText={(t) => setIsian((l) => ({ ...l, keterangan: t }))} maxLength={255} placeholder="mis. Dinas luar Surabaya" invalid={galat.reason !== undefined} accessibilityLabel="Keterangan" />
          </Field>
          {galat.umum ? (
            <Text variant="meta" tone="danger" accessibilityRole="alert">
              {galat.umum}
            </Text>
          ) : null}
          <Button title={mengubah ? 'Simpan perubahan' : 'Simpan delegasi'} onPress={() => void simpan()} loading={menyimpan} loadingTitle="Menyimpan…" disabled={offline} disabledReason={offline ? 'Tidak ada koneksi' : undefined} />
          {mengubah ? (
            <Button
              title="Batal ubah"
              variant="quiet"
              onPress={() => {
                setIsian(isianKosong(hariIni));
                setGalat({});
              }}
            />
          ) : null}
        </View>
      </>
    );
  }

  return (
    <Screen header={<SubAppBar title="Delegasi persetujuan" onBack={() => router.back()} />} onRefresh={() => void muat()}>
      {isi}
      <PemilihRekan
        visible={pemilih}
        terpilihId={isian.rekan?.id ?? null}
        kecualikan={kecualikan}
        onClose={() => setPemilih(false)}
        onPilih={(o: OrangPilihan) => {
          setIsian((l) => ({ ...l, rekan: { id: o.id, name: o.name } }));
          setGalat((g) => ({ ...g, delegate_id: undefined }));
          setPemilih(false);
        }}
      />
    </Screen>
  );
}
