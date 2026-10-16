/**
 * Privasi & Data Saya — data pribadi sendiri (`GET /privasi/data-saya`):
 * persetujuan lokasi & selfie (beri/cabut/setuju ulang), unduh Excel/PDF,
 * ringkasan absensi, pengajuan, keputusan, dan profil (NIK tersamar).
 * Mockup: docs/mockups/android/screens/01-akses-akun/20-privasi-data-saya,
 * 21-privasi-persetujuan, 21-privasi-unduh-keadaan.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  berikanPersetujuan,
  cabutPersetujuan,
  dataSaya,
  GalatUnduh,
  unduhEkspor,
  type DataSaya,
  type FormatEkspor,
  type Persetujuan,
} from '@/api/privasi';
import { tglJamLengkap, tglPendekYMD } from '@/features/settings/konstanta';
import { BarisNilai, GroupLabel } from '@/features/settings/parts';
import { labelDariKode } from '@/features/settings/profile';
import { useTheme } from '@/theme';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  OfflineBanner,
  Pressable,
  Screen,
  SectionHeader,
  Skeleton,
  SubAppBar,
  Text,
  useDialog,
  useSnackbar,
  errorKindFromStatus,
  type Tone,
} from '@/ui';

function nadaStatusAbsensi(status: string): Tone {
  if (status === 'present' || status === 'wfh') return 'success';
  if (status === 'late' || status === 'early_leave' || status === 'needs_correction') return 'warning';
  if (status === 'absent') return 'danger';
  if (status === 'leave' || status === 'permit' || status === 'sick' || status === 'business_trip') return 'info';
  return 'neutral';
}

function nadaStatusPengajuan(status: string): Tone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending' || status === 'revision_requested') return 'warning';
  return 'neutral';
}

const URUTAN_RINGKAS: { kode: string; label: string }[] = [
  { kode: 'present', label: 'Hadir' },
  { kode: 'late', label: 'Terlambat' },
  { kode: 'leave', label: 'Cuti' },
  { kode: 'permit', label: 'Izin' },
  { kode: 'sick', label: 'Sakit' },
  { kode: 'absent', label: 'Alpha' },
];

type Unduhan = { jenis: 'diam' } | { jenis: 'berjalan'; format: FormatEkspor } | { jenis: 'gagal'; format: FormatEkspor; pesan: string };

function tglHariPanjang(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    return ymd;
  }
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function KartuPersetujuan({
  consent,
  sibuk,
  onBeri,
  onCabut,
}: {
  consent: Persetujuan;
  sibuk: boolean;
  onBeri: () => void;
  onCabut: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [riwayat, setRiwayat] = useState(false);
  const aktif = consent.granted;

  return (
    <Card style={{ gap: 14 }}>
      <Text variant="h3">Persetujuan lokasi & selfie</Text>
      {aktif ? (
        <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
          Dasar pemrosesan lokasi GPS dan foto selfie saat check-in/check-out (UU PDP).
        </Text>
      ) : null}

      {aktif ? (
        <Banner
          tone="ok"
          icon="shield-check"
          title="Lokasi & selfie: disetujui"
          message={`Untuk kebijakan versi ${consent.granted_version ?? consent.version}${consent.granted_at ? `, sejak ${tglPendekYMD(consent.granted_at.slice(0, 10))}` : ''}.`}
        />
      ) : consent.needs_renewal ? (
        <Banner
          tone="warn"
          title="Lokasi & selfie: perlu persetujuan ulang"
          message={`Kebijakan berubah ke versi ${consent.version}. Check-in GPS + selfie tidak bisa dilakukan sampai Anda menyetujui versi ini.`}
        />
      ) : (
        <Banner
          tone="warn"
          icon="shield-alert"
          title="Lokasi & selfie: belum disetujui"
          message="Check-in GPS + selfie tidak bisa dilakukan. Kiosk QR dan koreksi oleh HR tetap tersedia."
        />
      )}

      {aktif ? (
        <>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {`Selfie dihapus otomatis setelah ${consent.retention_months} bulan.`}
          </Text>
          <Pressable
            onPress={() => router.push('/privasi/kebijakan' as never)}
            scaleTo={1}
            accessibilityRole="link"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="label" tone="link">
              {`Baca kebijakan privasi v${consent.policy_version}`}
            </Text>
          </Pressable>
          <Button title="Cabut persetujuan" variant="outline" disabled={sibuk} onPress={onCabut} style={{ borderColor: colors.borderStrong }} />
          <Pressable
            onPress={() => setRiwayat((v) => !v)}
            scaleTo={1}
            accessibilityRole="button"
            accessibilityState={{ expanded: riwayat }}
            accessibilityLabel={`Riwayat persetujuan, ${consent.history.length} catatan`}
            style={s.riwayatTombol}
          >
            <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 15 }}>
              {`Riwayat persetujuan (${consent.history.length})`}
            </Text>
            <Icon name={riwayat ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
          </Pressable>
          {riwayat
            ? consent.history.map((h) => (
                <View key={h.id} style={s.riwayatBaris}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{h.type_label}</Text>
                    <Text variant="meta">{`Versi ${h.version} · ${tglJamLengkap(h.granted_at)}`}</Text>
                  </View>
                  <Badge tone={h.revoked_at ? 'neutral' : 'success'}>{h.revoked_at ? 'Dicabut' : 'Aktif'}</Badge>
                </View>
              ))
            : null}
        </>
      ) : (
        <Button title={consent.needs_renewal ? `Setujui versi ${consent.version}` : 'Berikan persetujuan'} disabled={sibuk} loading={sibuk} onPress={onBeri} />
      )}
    </Card>
  );
}

export default function LayarPrivasi(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [data, setData] = useState<DataSaya | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [sibukConsent, setSibukConsent] = useState(false);
  const [unduh, setUnduh] = useState<Unduhan>({ jenis: 'diam' });
  const pembatal = useRef<AbortController | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      setData(await dataSaya());
      setGalat(null);
      setOffline(false);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setOffline(status === 0);
      setGalat({ pesan: err instanceof ApiError && status !== 0 ? err.message : 'Koneksi ke server terputus. Data Anda aman, coba muat lagi.', status });
    } finally {
      setMemuat(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const ubahConsent = (consent: Persetujuan): void => {
    setData((d) => (d ? { ...d, consent } : d));
  };

  const beri = async (): Promise<void> => {
    if (!data) return;
    const c = data.consent;
    const setuju = await dialog.confirm({
      title: c.needs_renewal ? `Setujui kebijakan versi ${c.version}?` : 'Berikan persetujuan?',
      message: 'Lokasi GPS dan foto selfie diproses hanya saat Anda check-in atau check-out, untuk mencatat kehadiran. Anda dapat mencabutnya kapan saja.',
      confirmLabel: 'Setujui',
      cancelLabel: 'Batal',
    });
    if (!setuju) return;
    setSibukConsent(true);
    try {
      ubahConsent(await berikanPersetujuan());
      snackbar.show({ message: 'Persetujuan lokasi & selfie disimpan.', variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.status === 0 ? 'Tidak ada koneksi. Persetujuan belum tersimpan.' : (err.firstValidationError ?? err.message)) : 'Persetujuan gagal disimpan.', variant: 'bad' });
    } finally {
      setSibukConsent(false);
    }
  };

  const cabut = async (): Promise<void> => {
    const setuju = await dialog.confirm({
      title: 'Cabut persetujuan?',
      message: 'Check-in dan check-out dengan GPS + selfie dinonaktifkan sampai Anda menyetujui lagi. HR akan diberi tahu untuk mengatur cara absensi lain. Data yang sudah tercatat tetap disimpan sesuai kebijakan.',
      confirmLabel: 'Cabut persetujuan',
      cancelLabel: 'Batal',
      destructive: true,
    });
    if (!setuju) return;
    setSibukConsent(true);
    try {
      ubahConsent(await cabutPersetujuan());
      snackbar.show({
        message: 'Persetujuan dicabut. HR sudah diberi tahu.',
        variant: 'info',
        actionLabel: 'Urungkan',
        onAction: () => {
          void berikanPersetujuan()
            .then(ubahConsent)
            .catch(() => snackbar.show({ message: 'Persetujuan gagal dipulihkan.', variant: 'bad' }));
        },
      });
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.status === 0 ? 'Tidak ada koneksi. Persetujuan belum dicabut.' : err.message) : 'Persetujuan gagal dicabut.', variant: 'bad' });
    } finally {
      setSibukConsent(false);
    }
  };

  const mulaiUnduh = async (format: FormatEkspor): Promise<void> => {
    if (unduh.jenis === 'berjalan') return;
    pembatal.current?.abort();
    const kontrol = new AbortController();
    pembatal.current = kontrol;
    setUnduh({ jenis: 'berjalan', format });
    try {
      const berkas = await unduhEkspor(format, kontrol.signal);
      setUnduh({ jenis: 'diam' });
      snackbar.show({
        message: `data-saya.${format} diunduh`,
        variant: 'ok',
        actionLabel: 'Buka',
        onAction: () => {
          void Linking.openURL(berkas.contentUri).catch(() =>
            snackbar.show({ message: 'Tidak ada aplikasi untuk membuka berkas ini. Berkas ada di penyimpanan RuangKerja.', variant: 'warn' }),
          );
        },
        duration: 8000,
      });
    } catch (err) {
      if (kontrol.signal.aborted) {
        setUnduh({ jenis: 'diam' });
        return;
      }
      setUnduh({ jenis: 'gagal', format, pesan: err instanceof GalatUnduh ? err.message : 'Koneksi terputus sebelum berkas selesai.' });
    }
  };

  const batalUnduh = (): void => {
    pembatal.current?.abort();
    setUnduh({ jenis: 'diam' });
  };

  return (
    <Screen header={<SubAppBar title="Privasi & data saya" />} onRefresh={() => void muat()} refreshing={memuat && data !== null}>
      <Text variant="body" tone="muted">
        Data pribadi Anda yang tersimpan di aplikasi ini. Hanya Anda yang melihat layar ini.
      </Text>

      {offline && data !== null ? <OfflineBanner /> : null}

      {memuat && data === null ? (
        <>
          <Skeleton height={20} width="70%" />
          <Card style={{ gap: 12 }}>
            <Skeleton height={26} width="60%" />
            <Skeleton height={64} />
            <Skeleton height={48} />
          </Card>
          <Card style={{ gap: 12 }}>
            <Skeleton height={26} width="50%" />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Card>
        </>
      ) : galat && data === null ? (
        <ErrorState title="Data belum termuat" message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : data ? (
        <>
          <Pressable
            onPress={() => router.push('/privasi/kebijakan' as never)}
            scaleTo={1}
            accessibilityRole="link"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
          >
            <Icon name="shield-check" size={20} color={colors.link} />
            <Text variant="label" tone="link">
              {`Kebijakan privasi v${data.policy.version} · berlaku ${tglPendekYMD(data.policy.effective_date)}`}
            </Text>
          </Pressable>

          <KartuPersetujuan consent={data.consent} sibuk={sibukConsent} onBeri={() => void beri()} onCabut={() => void cabut()} />

          <Card style={{ gap: 12 }}>
            <Text variant="h3">Unduh data saya</Text>
            <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
              Profil, persetujuan, seluruh absensi & log, pengajuan, dan keputusan persetujuan Anda.
            </Text>
            {unduh.jenis === 'berjalan' ? (
              <Banner tone="info" icon="download" title={`Menyiapkan data-saya.${unduh.format}…`} message="Berkas dibuat di server lalu disimpan di aplikasi. Jangan tutup aplikasi." actionLabel="Batal" onAction={batalUnduh} />
            ) : unduh.jenis === 'gagal' ? (
              <Banner tone="bad" title="Unduhan gagal" message={unduh.pesan} actionLabel="Coba lagi" onAction={() => void mulaiUnduh(unduh.format)} />
            ) : null}
            <View style={s.unduh}>
              <ListRow
                style={[s.unduhBaris, { borderColor: colors.borderStrong }]}
                icon="file-spreadsheet"
                iconTone="ok"
                title="Unduh Excel"
                subtitle="Satu sheet per jenis data"
                trailing={<Icon name="download" size={22} color={colors.muted} />}
                onPress={unduh.jenis === 'berjalan' ? undefined : () => void mulaiUnduh('xlsx')}
              />
              <ListRow
                style={[s.unduhBaris, { borderColor: colors.borderStrong }]}
                icon="file-text"
                iconTone="bad"
                title="Unduh PDF"
                subtitle="Siap dicetak"
                trailing={<Icon name="download" size={22} color={colors.muted} />}
                onPress={unduh.jenis === 'berjalan' ? undefined : () => void mulaiUnduh('pdf')}
              />
            </View>
            <Text variant="meta" style={{ fontSize: 14 }}>
              NIK ditampilkan tersamar dan foto selfie tidak disertakan. Setiap unduhan tercatat di log audit.
            </Text>
          </Card>

          <Card style={{ gap: 12 }}>
            <SectionHeader title="Data absensi" actionLabel="Riwayat per bulan" onAction={() => router.push('/absensi/riwayat' as never)} />
            {data.attendance.total_days === 0 ? (
              <EmptyState icon="inbox" title="Belum ada data absensi" description="Data muncul di sini setelah check-in pertama Anda." variant="plain" />
            ) : (
              <>
                <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
                  {`${data.attendance.total_days} hari tercatat${data.attendance.first_date ? ` sejak ${tglPendekYMD(data.attendance.first_date)}` : ''} · ${data.attendance.logs} log check-in/out · ${data.attendance.selfies} selfie tersimpan`}
                </Text>
                <View style={s.chips}>
                  {URUTAN_RINGKAS.filter((r) => (data.attendance.counts[r.kode] ?? 0) > 0).map((r) => (
                    <Badge key={r.kode} tone="neutral" dot={false}>{`${data.status_labels[r.kode] ?? r.label} ${data.attendance.counts[r.kode]}`}</Badge>
                  ))}
                </View>
                <View>
                  {data.attendance.days.slice(0, 3).map((h, i) => (
                    <ListRow
                      key={h.date}
                      divider={i > 0}
                      style={s.barisDalam}
                      title={tglHariPanjang(h.date)}
                      subtitle={h.check_in ? `${h.check_in} → ${h.check_out ?? '—'}` : 'Belum check-in'}
                      trailing={h.check_in || h.status !== 'absent' ? <Badge tone={nadaStatusAbsensi(h.status)}>{h.status_label}</Badge> : undefined}
                    />
                  ))}
                </View>
              </>
            )}
          </Card>

          <Card style={{ gap: 12 }}>
            <SectionHeader
              title="Pengajuan saya"
              actionLabel="Semua pengajuan"
              onAction={() => router.push('/pengajuan' as never)}
            />
            {data.requests.items.length === 0 ? (
              <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
                Belum ada pengajuan.
              </Text>
            ) : (
              <View>
                {data.requests.items.slice(0, 3).map((r, i) => (
                  <ListRow
                    key={r.id}
                    divider={i > 0}
                    style={s.barisDalam}
                    title={<Text variant="mono">{r.number ?? 'Draf'}</Text>}
                    subtitle={`${r.type}${r.summary ? ` · ${r.summary}` : ''}`}
                    trailing={<Badge tone={nadaStatusPengajuan(r.status)}>{r.status_label}</Badge>}
                  />
                ))}
              </View>
            )}
          </Card>

          <Card style={{ gap: 12 }}>
            <Text variant="h3">Keputusan persetujuan Anda</Text>
            {data.decisions.items.length === 0 ? (
              <EmptyState icon="inbox" title="Belum ada keputusan" description="Muncul bila Anda pernah menyetujui atau menolak pengajuan orang lain." />
            ) : (
              <View>
                {data.decisions.items.slice(0, 3).map((k, i) => (
                  <ListRow
                    key={k.id}
                    divider={i > 0}
                    style={s.barisDalam}
                    title={k.number ?? k.type}
                    subtitle={`${k.requester} · ${k.type}`}
                    trailing={<Badge tone={k.decision === 'approve' ? 'success' : 'danger'}>{k.decision_label}</Badge>}
                  />
                ))}
              </View>
            )}
          </Card>

          <View style={{ gap: 8 }}>
            <GroupLabel>Data profil</GroupLabel>
            <Card style={{ paddingVertical: 4, gap: 0 }}>
              <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22, paddingVertical: 12 }}>
                Data kepegawaian yang tersimpan. Hubungi HR bila ada yang keliru.
              </Text>
              {(() => {
                const p = data.profile;
                const peranLabel = labelDariKode(p.roles).join(', ');
                const baris: [string, string | null][] = [
                  ['No. karyawan', p.employee_number],
                  ['NIK', p.nik_masked],
                  ['Telepon', p.phone],
                  ['Tanggal lahir', p.birth_date ? tglPendekYMD(p.birth_date) : null],
                  ['Divisi / Tim', [p.division, p.team].filter(Boolean).join(' / ') || null],
                  ['Atasan', p.manager],
                  ['Peran akses', peranLabel || null],
                  ['Akun Google', p.google_linked ? 'Tersambung' : 'Belum tertaut'],
                  ['Login terakhir', p.last_login_at ? tglJamLengkap(p.last_login_at) : null],
                ];
                const terisi = baris.filter(([, v]) => v !== null);
                return terisi.map(([label, nilai], i) => <BarisNilai key={label} label={label} nilai={nilai ?? ''} divider={i < terisi.length - 1} />);
              })()}
            </Card>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  riwayatTombol: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  riwayatBaris: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  unduh: { gap: 10 },
  unduhBaris: { borderWidth: 1, borderRadius: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  barisDalam: { paddingHorizontal: 0 },
});
