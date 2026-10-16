/**
 * Review notulen otomatis (mockup 08 › 24): status merekam/mentranskrip/
 * meringkas/siap/gagal, tab Draf notulen · Transkrip, Masukkan ke notulen
 * (sekali, 409 bila sudah) / Buang draf, Ringkas ulang, usulan tindak lanjut
 * → tugas, opt-out "Jangan transkrip suara saya". Viewer tanpa hak transkrip
 * (pengamat rapat pimpinan) hanya melihat status.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { detailRapat } from '@/api/endpoints';
import { aturPersetujuanTranskrip, bacaTranskrip, buangDraf, masukkanDraf, ringkasUlang, usulanJadiTugas, type PoinSumber, type RingkasanNotulenOtomatis, type Transkrip } from '@/api/rapat';
import type { MeetingDetailResponse } from '@/api/types';
import { bukaNotulen } from '@/features/rapat/navigasi';
import { hariSingkat, namaDepan } from '@/features/rapat/util';
import { jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, Badge, Banner, Button, Card, EmptyState, ErrorState, Icon, Loading, Pressable, Screen, SearchInput, SegmentedTabs, SubAppBar, Switch, Tag, Text, useDialog, useSnackbar } from '@/ui';

type Tab = 'draf' | 'transkrip';

function teksPoin(p: PoinSumber | string): string {
  return typeof p === 'string' ? p : p.teks;
}

/** Offset rekaman "07.58" (mm.ss; jam.mm.ss bila ≥ 1 jam). */
function offset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const j = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return j > 0 ? `${j}.${mm}.${ss}` : `${mm}.${ss}`;
}

function waktuSumber(p: PoinSumber | string): string | null {
  if (typeof p === 'string' || !p.sumber || typeof p.sumber !== 'object') {
    return null;
  }
  const s = p.sumber as { start_ms?: unknown };
  return typeof s.start_ms === 'number' ? offset(s.start_ms) : null;
}

const TAHAP: { kode: string; label: string }[] = [
  { kode: 'recording', label: 'Merekam' },
  { kode: 'transcribing', label: 'Mentranskrip' },
  { kode: 'summarizing', label: 'Meringkas' },
  { kode: 'ready', label: 'Siap' },
];

export default function LayarTranskrip(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const param = useLocalSearchParams<{ id: string; tanggal?: string }>();
  const id = typeof param.id === 'string' ? param.id : '';
  const tanggal = typeof param.tanggal === 'string' && param.tanggal !== '' ? param.tanggal : null;

  const [rapat, setRapat] = useState<MeetingDetailResponse | null>(null);
  const [ring, setRing] = useState<RingkasanNotulenOtomatis | null>(null);
  const [trans, setTrans] = useState<Transkrip | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<Tab>('draf');
  const [cari, setCari] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [poinTerbuka, setPoinTerbuka] = useState(false);
  const [tugasUsulan, setTugasUsulan] = useState<Record<string, string>>({});

  const muat = useCallback(async (): Promise<void> => {
    try {
      const [d, t] = await Promise.all([detailRapat(id, tanggal), bacaTranskrip(id, tanggal)]);
      setRapat(d);
      setRing(t.notulen);
      setTrans(t.transkrip);
      setGalat(null);
    } catch (err) {
      setGalat(err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Notulen otomatis tidak dapat dimuat.' }));
    }
  }, [id, tanggal]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  const status = ring?.transcript?.status ?? null;
  const diproses = status === 'recording' || status === 'transcribing' || status === 'summarizing' || ring?.draft?.status === 'pending';
  useEffect(() => {
    if (!diproses) {
      return undefined;
    }
    const t = setInterval(() => void muat(), 15_000);
    return () => clearInterval(t);
  }, [diproses, muat]);

  const segmen = useMemo(() => {
    const k = cari.trim().toLowerCase();
    const semua = trans?.segments ?? [];
    return k ? semua.filter((sg) => sg.text.toLowerCase().includes(k) || sg.speaker_name.toLowerCase().includes(k)) : semua;
  }, [trans, cari]);

  async function aksi(fn: () => Promise<void>): Promise<void> {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    try {
      await fn();
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Permintaan gagal. Coba lagi.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
      if (err instanceof ApiError && err.status === 409) {
        void muat();
      }
    } finally {
      setSibuk(false);
    }
  }

  async function masukkan(): Promise<void> {
    const ok = await dialog.confirm({
      title: 'Masukkan ke notulen?',
      message: 'Poin ditambahkan di bawah tulisan Anda dengan penanda "[Draf otomatis — periksa sebelum final]". Ringkasan menjadi bagian "Ringkasan (draf otomatis)", usulan menjadi tindak lanjut. Tulisan Anda tidak ditimpa. Hanya bisa sekali.',
      confirmLabel: 'Masukkan',
    });
    if (ok) {
      await aksi(async () => {
        const hasil = await masukkanDraf(id, tanggal);
        snackbar.show({ message: hasil.message, variant: 'ok', actionLabel: 'Buka notulen', onAction: () => bukaNotulen(id, tanggal) });
        await muat();
      });
    }
  }

  async function buang(): Promise<void> {
    const ok = await dialog.confirm({ title: 'Buang draf AI?', message: `Draf dibuang. Transkrip tetap ada sampai ${ring?.retention_days ?? 90} hari dan Anda masih bisa meringkas ulang.`, confirmLabel: 'Buang draf', destructive: true });
    if (ok) {
      await aksi(async () => {
        setRing(await buangDraf(id, tanggal));
        snackbar.show({ message: 'Draf dibuang.', variant: 'ok' });
      });
    }
  }

  if (galat && !ring) {
    return (
      <Screen header={<SubAppBar title="Notulen otomatis" />}>
        {galat.status === 404 || galat.status === 403 ? (
          <EmptyState icon="sparkles" title="Notulen otomatis tidak tersedia" description={galat.status === 403 ? galat.message : 'Rapat tidak ada atau Anda tidak memiliki akses.'} actionLabel="Kembali" onAction={() => router.back()} />
        ) : (
          <ErrorState kind={galat.status === 0 ? 'offline' : 'umum'} title="Notulen otomatis tidak dapat dimuat" message={galat.message} onRetry={() => void muat()} />
        )}
      </Screen>
    );
  }
  if (!ring || !rapat) {
    return (
      <Screen header={<SubAppBar title="Notulen otomatis" />}>
        <Loading label="Memuat notulen otomatis…" />
      </Screen>
    );
  }

  const m = rapat.meeting;
  const t = ring.transcript;
  const draf = ring.draft;
  const kelola = ring.can_manage;
  const bisaLihat = ring.can_view_transcript && trans !== null;
  const drafSiap = draf?.status === 'ready';
  const dimasukkan = draf?.status === 'inserted';
  const label = !t ? 'BELUM ADA' : status === 'failed' ? 'GAGAL' : diproses ? 'DIPROSES' : dimasukkan ? 'DIMASUKKAN' : !bisaLihat ? 'STATUS' : 'DRAF';
  const meta = [
    hariSingkat(m.occurrence_date),
    t?.updated_at && !diproses ? `selesai ${jam(t.updated_at)}` : null,
    t?.duration_seconds ? `${Math.round(t.duration_seconds / 60)} mnt` : null,
    `${m.participants.length} peserta`,
    ring.optout_count > 0 ? `${ring.optout_count} orang memilih tidak ditranskrip` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const totalDetik = (t?.speakers ?? []).reduce((a, b) => a + b.seconds, 0);

  const footer =
    kelola && drafSiap ? (
      <>
        <Button title="Buang draf" variant="outline" disabled={sibuk} onPress={() => void buang()} style={{ flex: 1 }} />
        <Button title="Masukkan ke notulen" icon="file-text" loading={sibuk} onPress={() => void masukkan()} style={{ flex: 1.4 }} />
      </>
    ) : null;

  return (
    <Screen header={<SubAppBar title="Notulen otomatis" />} footer={footer} refreshing={false} onRefresh={() => void muat()}>
      <View style={{ gap: 6 }}>
        <Text variant="overline">{`NOTULEN OTOMATIS · ${label}`}</Text>
        <Text variant="h2">{m.title}</Text>
        <Text variant="meta" style={{ fontSize: 15 }}>
          {meta}
        </Text>
      </View>

      {!t ? (
        <EmptyState icon="sparkles" title="Belum ada transkrip" description={ring.auto_minutes ? 'Transkrip muncul setelah rapat video selesai direkam.' : 'Notulen otomatis tidak dinyalakan untuk rapat ini.'} />
      ) : null}

      {t && diproses ? (
        <Card style={{ gap: 12 }}>
          <Text variant="h3">{t.status_label || 'Mentranskrip'}</Text>
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Suara peserta sedang ditulis menjadi teks. Biasanya beberapa menit sampai ±40 menit tergantung lama bicara. Halaman diperbarui tiap 15 detik.
          </Text>
          <View style={s.tahap}>
            {TAHAP.map((tp, i) => {
              const posisi = TAHAP.findIndex((x) => x.kode === (status === 'ready' ? 'summarizing' : status));
              const selesai = i < posisi;
              const aktif = i === posisi;
              return (
                <View key={tp.kode} style={{ flex: 1, gap: 6 }}>
                  <View style={[s.batang, { backgroundColor: selesai || aktif ? colors.primary : colors.surface2, opacity: aktif ? 0.6 : 1 }]} />
                  <Text variant="meta" weight={aktif ? 700 : 500} tone={aktif ? 'link' : 'muted'}>
                    {tp.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {t && status === 'failed' ? (
        <Card style={{ gap: 10 }}>
          <Banner tone="bad" icon="circle-x" message={`Transkripsi gagal. ${t.error ?? 'Kesalahan di server notulen.'} Coba ringkas ulang; bila tetap gagal, hubungi admin.`} />
          {kelola ? <Button title="Ringkas ulang" icon="refresh-cw" loading={sibuk} onPress={() => void aksi(async () => setRing(await ringkasUlang(id, tanggal)))} /> : null}
        </Card>
      ) : null}
      {t && !ring.llm.enabled && !diproses ? <Banner tone="neutral" icon="info" message="Ringkasan AI tidak aktif di server ini; transkrip tetap bisa dibaca." /> : null}

      {t && !bisaLihat && !diproses ? (
        <Card style={{ gap: 8 }}>
          <Text variant="h3">{drafSiap ? 'Draf siap diperiksa notulis' : (draf?.status_label ?? t.status_label)}</Text>
          <Text variant="meta">Transkrip dan draf hanya bisa dibuka penyelenggara, notulis, dan peserta yang diundang.</Text>
          <Text variant="meta">Pengamat rapat pimpinan hanya melihat status, tanpa transkrip, nama pembicara, atau draf.</Text>
        </Card>
      ) : null}

      {dimasukkan && draf?.inserted_at ? (
        <Banner tone="ok" icon="circle-check" message={`Draf dimasukkan ke notulen pukul ${jam(draf.inserted_at)}. Rapikan lalu finalkan.`} actionLabel="Buka notulen" onAction={() => bukaNotulen(id, m.occurrence_date)} />
      ) : null}

      {bisaLihat && !diproses ? (
        <>
          <View style={s.baris}>
            <Badge tone="success">Transkrip siap</Badge>
            {kelola && status !== 'failed' && ring.llm.enabled ? (
              <Pressable onPress={() => void aksi(async () => setRing(await ringkasUlang(id, tanggal)))} accessibilityRole="button" accessibilityLabel="Ringkas ulang" hitSlop={8} style={s.baris}>
                <Icon name="refresh-cw" size={16} color={colors.link} />
                <Text variant="label" tone="link">
                  Ringkas ulang
                </Text>
              </Pressable>
            ) : null}
          </View>
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'draf', label: 'Draf notulen' },
              { value: 'transkrip', label: 'Transkrip' },
            ]}
          />
          {tab === 'draf' ? (
            draf && (draf.status === 'ready' || draf.status === 'inserted') ? (
              <Card style={{ gap: 12 }}>
                <View style={s.baris}>
                  <Text variant="h3" style={{ flex: 1 }}>
                    Draf notulen
                  </Text>
                  <Icon name="sparkles" size={16} color={colors.muted} />
                  <Text variant="meta">Diringkas AI · periksa sebelum final</Text>
                </View>
                {draf.ringkasan ? (
                  <Text variant="body">
                    <Text variant="body" weight={700}>
                      Ringkasan.{' '}
                    </Text>
                    {draf.ringkasan}
                  </Text>
                ) : null}
                {draf.keputusan && draf.keputusan.length > 0 ? (
                  <>
                    <Text variant="overline" tone="muted">
                      KEPUTUSAN
                    </Text>
                    {draf.keputusan.map((k, i) => (
                      <View key={`k-${i}`} style={[s.keputusan, { backgroundColor: colors.successSoft }]}>
                        <Icon name="flag" size={18} color={colors.success} />
                        <Text variant="body" style={{ flex: 1 }}>
                          {teksPoin(k)}
                        </Text>
                        {waktuSumber(k) ? (
                          <Text variant="mono" tone="link">
                            {waktuSumber(k)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </>
                ) : null}
                {draf.tindak_lanjut && draf.tindak_lanjut.length > 0 ? (
                  <>
                    <Text variant="overline" tone="muted">
                      USULAN TINDAK LANJUT
                    </Text>
                    {draf.tindak_lanjut.map((u) => {
                      const kunci = u.task?.key ?? tugasUsulan[u.id] ?? null;
                      const nama = u.penanggung_jawab?.nama ?? null;
                      return (
                        <View key={u.id} style={[s.usulan, { borderColor: colors.border }]}>
                          <Text variant="label" style={{ fontSize: 16 }}>
                            {u.judul}
                          </Text>
                          <View style={s.baris}>
                            {nama ? <Avatar name={nama} size="sm" /> : null}
                            <Text variant="meta" style={{ flex: 1 }}>
                              {[nama ? namaDepan(nama) : 'PIC belum dipilih', u.tenggat ? hariSingkat(u.tenggat) : null].filter(Boolean).join(' · ')}
                            </Text>
                            {kunci ? (
                              <Tag tone="info">{kunci}</Tag>
                            ) : kelola && !dimasukkan ? (
                              <Button
                                title="Jadikan tugas"
                                size="sm"
                                variant="tonal"
                                onPress={() =>
                                  void aksi(async () => {
                                    const hasil = await usulanJadiTugas(id, tanggal, u.id, null);
                                    if (hasil.task) {
                                      const key = hasil.task.key;
                                      setTugasUsulan((l) => ({ ...l, [u.id]: key }));
                                      snackbar.show({ message: `Tugas dibuat: ${key}`, variant: 'ok' });
                                    }
                                  })
                                }
                              />
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : null}
                {(draf.perlu_dicek ?? []).map((p, i) => (
                  <Banner key={`cek-${i}`} tone="warn" icon="clock" title="Perlu dicek:" message={teksPoin(p)} />
                ))}
                {draf.agenda && draf.agenda.length > 0 ? (
                  <>
                    <Pressable onPress={() => setPoinTerbuka(!poinTerbuka)} accessibilityRole="button" accessibilityState={{ expanded: poinTerbuka }} style={[s.lipat, { borderColor: colors.border }]}>
                      <Icon name={poinTerbuka ? 'chevron-down' : 'chevron-right'} size={20} color={colors.muted} />
                      <Text variant="label">{`Poin per agenda (${draf.agenda.length})`}</Text>
                    </Pressable>
                    {poinTerbuka
                      ? draf.agenda.map((a, i) => (
                          <View key={`a-${i}`} style={{ gap: 4 }}>
                            <Text variant="label">{`${i + 1}. ${a.judul}`}</Text>
                            {a.poin.map((p, j) => (
                              <Text key={`p-${j}`} variant="body" style={{ fontSize: 15 }}>{`• ${teksPoin(p)}`}</Text>
                            ))}
                          </View>
                        ))
                      : null}
                  </>
                ) : null}
              </Card>
            ) : (
              <Card style={{ gap: 8 }}>
                <Text variant="h3">{draf?.status === 'discarded' ? 'Draf dibuang' : draf?.status === 'disabled' ? 'Ringkasan AI tidak aktif' : draf?.status === 'failed' ? 'Ringkasan gagal' : 'Draf belum tersedia'}</Text>
                <Text variant="meta">{draf?.error ?? (draf?.status === 'discarded' ? `Transkrip tetap ada sampai ${ring.retention_days} hari; Anda masih bisa meringkas ulang.` : 'Transkrip tetap bisa dibaca di tab Transkrip.')}</Text>
                {kelola && draf && (draf.status === 'discarded' || draf.status === 'failed') && ring.llm.enabled ? (
                  <Button title="Ringkas ulang" icon="refresh-cw" variant="outline" loading={sibuk} onPress={() => void aksi(async () => setRing(await ringkasUlang(id, tanggal)))} />
                ) : null}
              </Card>
            )
          ) : (
            <Card style={{ gap: 12 }}>
              {t && t.speakers.length > 0 ? (
                <>
                  <Text variant="label">Pembicara</Text>
                  <View style={s.bungkus}>
                    {t.speakers.map((sp) => (
                      <Tag key={sp.identity} tone="neutral">{`${namaDepan(sp.name)} ${totalDetik > 0 ? Math.round((sp.seconds / totalDetik) * 100) : 0}%`}</Tag>
                    ))}
                  </View>
                </>
              ) : null}
              <SearchInput value={cari} onChangeText={setCari} placeholder="Cari di transkrip…" />
              {segmen.length === 0 ? <Text variant="meta">{cari ? 'Tidak ada yang cocok.' : 'Transkrip kosong.'}</Text> : null}
              {segmen.map((sg) => (
                <View key={sg.i} style={{ gap: 2 }}>
                  <View style={s.baris}>
                    <Text variant="label">{sg.speaker_name}</Text>
                    <Text variant="mono" tone="muted">
                      {offset(sg.start_ms)}
                    </Text>
                  </View>
                  <Text variant="body" style={{ fontSize: 16 }}>
                    {sg.text}
                  </Text>
                </View>
              ))}
              <Text variant="meta">{`Audio sudah dihapus setelah transkripsi. Transkrip hanya bisa dibuka peserta, disimpan ${ring.retention_days} hari.`}</Text>
            </Card>
          )}
        </>
      ) : null}

      {ring.consent.can_change ? (
        <Card style={{ gap: 8 }}>
          <View style={s.baris}>
            <Switch
              value={ring.consent.opted_out}
              onValueChange={(v) =>
                void (async () => {
                  if (v && t && t.status !== 'recording') {
                    const ok = await dialog.confirm({
                      title: 'Hapus ucapan Anda dari transkrip?',
                      message: 'Ucapan Anda dihapus dari transkrip dan draf AI, kecuali bagian yang sudah dimasukkan notulis ke notulen — minta notulis memperbaikinya. Kehadiran Anda tidak berubah.',
                      confirmLabel: 'Hapus ucapan saya',
                      destructive: true,
                    });
                    if (!ok) {
                      return;
                    }
                  }
                  await aksi(async () => {
                    const hasil = await aturPersetujuanTranskrip(id, v);
                    setRing((l) => (l ? { ...l, consent: { ...l.consent, opted_out: hasil } } : l));
                    await muat();
                  });
                })()
              }
              label="Jangan transkrip suara saya"
              disabled={sibuk}
            />
            <View style={{ flex: 1 }}>
              <Text variant="label">Jangan transkrip suara saya</Text>
              <Text variant="meta">{ring.consent.opted_out ? 'Ucapan Anda dihapus dari transkrip.' : 'Suara Anda ikut ditranskrip. Pilihan ini privat.'}</Text>
            </View>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tahap: { flexDirection: 'row', gap: 8 },
  batang: { height: 6, borderRadius: 3 },
  keputusan: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.lg },
  usulan: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 8 },
  lipat: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderRadius: radius.lg },
});
