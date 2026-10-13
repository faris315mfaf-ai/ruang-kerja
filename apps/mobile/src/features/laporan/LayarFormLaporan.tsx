/**
 * Layar "Laporan hari ini" (mockup 06 › 28–31): formulir dengan simpan
 * otomatis, saran tugas, pilih/cari tugas, pindahkan ke, kirim dengan
 * konfirmasi ringkas, hasil pindah per tugas, keadaan offline/terkunci/libur.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import type { HasilPindah, OpsiTugas } from '@/api/laporan';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import {
  Badge,
  Banner,
  Button,
  Chip,
  ChipScroller,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  Loading,
  Pressable,
  Screen,
  SubAppBar,
  Text,
  errorKindFromStatus,
  useSnackbar,
} from '@/ui';

import { tanggalLaporan, tanggalSingkat, ringkasPekerjaan } from './format';
import { KartuItem, namaTujuan } from './KartuItem';
import { PilihTugasSheet } from './PilihTugasSheet';
import { PindahkanKeSheet } from './PindahkanKeSheet';
import { useFormLaporan, type ItemForm } from './useFormLaporan';

function potong(t: string, n: number): string {
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

/** "PRG-24 dipindah ke Review; GDG-9 ke Selesai" */
function kalimatPindah(daftar: { key: string; ke: string }[]): string {
  return daftar.map((d, i) => (i === 0 ? `${d.key} dipindah ke ${d.ke}` : `${d.key} ke ${d.ke}`)).join('; ');
}

function BarisKonfirmasi({ icon, teks }: { icon: 'list-checks' | 'arrow-right-left' | 'triangle-alert'; teks: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.barisKonfirmasi}>
      <Icon name={icon} size={22} color={colors.text} />
      <Text variant="body" style={{ flex: 1 }}>
        {teks}
      </Text>
    </View>
  );
}

function BannerHasil({ hasil }: { hasil: HasilPindah[] }): React.JSX.Element {
  const gagal = hasil.filter((h) => !h.moved && h.error);
  const pindah = hasil.filter((h) => h.moved && h.to);
  if (gagal.length > 0) {
    const g = gagal.map((h) => `${h.task_key} tidak dipindah: ${h.error ?? ''}`.trim()).join(' ');
    return <Banner tone="warn" message={`Laporan terkirim, tetapi ${g}`} />;
  }
  if (pindah.length === 0) {
    return <Banner tone="ok" message="Terkirim. Atasan Anda bisa membacanya." />;
  }
  return <Banner tone="ok" message={`Terkirim. Dipindah: ${pindah.map((h) => `${h.task_key} → ${h.to?.name ?? ''}`).join(', ')}.`} />;
}

export function LayarFormLaporan(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const f = useFormLaporan();
  const { data, laporan, isian, galat, statusSimpan, opsi } = f;
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const [pilihTugas, setPilihTugas] = useState(false);
  const [kolomUntuk, setKolomUntuk] = useState<ItemForm | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [hasilPindah, setHasilPindah] = useState<HasilPindah[] | null>(null);
  const gulir = useRef<ScrollView>(null);
  const sudahBuka = useRef<string | null>(null);

  // Item pertama dibuka, lainnya diringkas — sekali per laporan yang dimuat.
  useEffect(() => {
    if (f.muat.status !== 'siap' || !data || sudahBuka.current === data.date + (laporan?.id ?? '')) return;
    sudahBuka.current = data.date + (laporan?.id ?? '');
    const pertama = isian.items[0];
    setTerbuka(new Set(pertama ? [pertama.kunci] : []));
  }, [f.muat.status, data, laporan?.id, isian.items]);

  // Kembali ke layar (mis. dari detail tugas): segarkan bila tidak ada perubahan yang belum tersimpan.
  const pertamaFokus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (pertamaFokus.current) {
        pertamaFokus.current = false;
        return;
      }
      if (statusSimpan === 'tersimpan' || statusSimpan === 'bersih') {
        void f.muatUlang();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat fokus kembali
    }, []),
  );

  const terkunci = statusSimpan === 'terkunci';
  const bacaSaja = terkunci || data?.can.edit === false;
  const batas = data?.limits ?? { items: 30, note: 2000, text: 5000 };
  const penuh = isian.items.length >= batas.items;
  const totalJam = isian.items.reduce((n, i) => n + (i.jam ?? 0), 0);
  const dipilih = useMemo(() => new Set(isian.items.map((i) => i.taskId).filter((x): x is string => x !== null)), [isian.items]);
  const saranChip = (data?.suggestions ?? []).filter((o) => !dipilih.has(o.id)).slice(0, 8);
  const adaGalatCatatan = Object.keys(galat).some((k) => k.endsWith(':progress_note'));
  const terkirim = laporan?.status === 'submitted';

  const bukaHanya = (kunci: string): void => setTerbuka(new Set([kunci]));
  const tambahTugas = (o: OpsiTugas): void => {
    const k = f.tambahTugas(o);
    if (k) bukaHanya(k);
    setPilihTugas(false);
  };
  const tambahDiLuar = (): void => {
    const k = f.tambahDiLuar();
    if (k) bukaHanya(k);
    setPilihTugas(false);
  };

  const mulaiKirim = async (): Promise<void> => {
    const g = f.validasiKirim();
    if (Object.keys(g).length > 0) {
      const r = await f.kirim(); // hanya menandai galat (tidak mengirim)
      if (!r.ok) snackbar.show({ message: r.pesan, variant: 'bad' });
      gulir.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setKonfirmasi(true);
  };

  const kirim = async (): Promise<void> => {
    const r = await f.kirim();
    setKonfirmasi(false);
    if (r.ok) {
      setHasilPindah(r.hasil.move_results);
      const pindah = r.hasil.move_results.filter((m) => m.moved && m.to);
      snackbar.show({
        message: pindah.length > 0 ? `Laporan terkirim ke atasan · ${pindah.map((m) => `${m.task_key} dipindah ke ${m.to?.name ?? ''}`).join(', ')}` : 'Laporan terkirim ke atasan',
        variant: 'ok',
      });
      return;
    }
    if (r.alasan === 'terkunci') {
      gulir.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    snackbar.show({ message: r.pesan, variant: r.alasan === 'offline' ? 'offline' : 'bad' });
    if (r.alasan === 'validasi') gulir.current?.scrollTo({ y: 0, animated: true });
  };

  if (f.muat.status === 'memuat' && !data) {
    return (
      <Screen header={<SubAppBar title="Laporan hari ini" />}>
        <Loading rows={5} label="Memuat laporan hari ini…" />
      </Screen>
    );
  }
  if (f.muat.status === 'galat' && !data) {
    return (
      <Screen header={<SubAppBar title="Laporan hari ini" />}>
        <ErrorState message={f.muat.pesan ?? 'Tidak dapat memuat laporan hari ini.'} kind={errorKindFromStatus(f.muat.kode)} onRetry={() => void f.muatUlang()} />
      </Screen>
    );
  }
  if (!data || !laporan) {
    return <Screen header={<SubAppBar title="Laporan hari ini" />}>{null}</Screen>;
  }

  const batasJam = jam(data.deadline);
  const lencana =
    laporan.status === 'submitted' ? (
      <Badge tone="success">{`Terkirim ${jam(laporan.submitted_at)}`}</Badge>
    ) : laporan.status === 'draft' || isian.items.length > 0 ? (
      <Badge tone="warning">Draf</Badge>
    ) : (
      <Badge tone="neutral">Belum lapor</Badge>
    );

  let statusTeks: React.ReactNode;
  if (terkunci) {
    statusTeks = (
      <Text variant="meta" tone="danger" style={{ fontSize: 14 }}>
        Gagal menyimpan
      </Text>
    );
  } else if (statusSimpan === 'offline' || statusSimpan === 'gagal') {
    statusTeks = (
      <Pressable onPress={f.simpanSekarang} accessibilityRole="button" accessibilityLabel={`${f.pesanSimpan ?? 'Gagal menyimpan'}. Coba simpan lagi`} style={s.statusTombol} scaleTo={1}>
        <Icon name={statusSimpan === 'offline' ? 'cloud-off' : 'circle-alert'} size={16} color={statusSimpan === 'offline' ? colors.warning : colors.danger} />
        <Text variant="meta" tone={statusSimpan === 'offline' ? 'warning' : 'danger'} style={{ fontSize: 14 }} numberOfLines={1}>
          {statusSimpan === 'offline' ? 'Draf belum tersimpan · Coba lagi' : 'Gagal menyimpan · Coba lagi'}
        </Text>
      </Pressable>
    );
  } else if (statusSimpan === 'menyimpan' || statusSimpan === 'menunggu') {
    statusTeks = (
      <Text variant="meta" style={{ fontSize: 14 }}>
        Menyimpan…
      </Text>
    );
  } else if (statusSimpan === 'bersih') {
    statusTeks = (
      <Text variant="meta" style={{ fontSize: 14 }}>
        Belum ada draf
      </Text>
    );
  } else {
    statusTeks = (
      <Text variant="meta" style={{ fontSize: 14 }}>
        {terkirim ? `Terkirim ${jam(laporan.submitted_at)} · masih bisa diubah` : `Tersimpan otomatis · ${jam(f.tersimpanPada)}`}
      </Text>
    );
  }

  const daftarPindah = isian.items
    .map((i) => {
      const o = i.taskId ? opsi[i.taskId] : undefined;
      const ke = namaTujuan(i, o);
      return o && ke && i.pindahKe !== o.status.id ? { key: o.key, ke } : null;
    })
    .filter((x): x is { key: string; ke: string } => x !== null);

  let footer: React.ReactNode;
  if (terkunci) {
    footer = (
      <View style={{ flex: 1, gap: 8 }}>
        <Button title="Tulis laporan hari ini" icon="refresh-cw" onPress={() => void f.muatUlang()} />
      </View>
    );
  } else if (bacaSaja) {
    footer = null;
  } else {
    const offline = statusSimpan === 'offline';
    const kosong = isian.items.length === 0;
    const teks = offline
      ? 'Offline — isian aman di perangkat, dikirim ke server saat tersambung'
      : kosong
        ? 'Tambahkan satu pekerjaan dulu'
        : terkirim
          ? `Terkirim ${tanggalSingkat(laporan.date).split(' ')[0]} ${jam(laporan.submitted_at)} — Anda bisa memperbaiki sampai ${batasJam}`
          : `Draf tersimpan otomatis. Bisa dikirim ulang sampai ${batasJam}.`;
    footer = (
      <View style={{ flex: 1, gap: 8 }}>
        <Text variant="meta" align="center" style={{ fontSize: 14 }}>
          {teks}
        </Text>
        <Button
          title={offline ? 'Kirim saat online' : terkirim ? 'Kirim ulang perubahan' : 'Kirim laporan'}
          icon="send"
          onPress={() => void mulaiKirim()}
          disabled={offline || kosong || data.can.submit === false}
          disabledReason={offline ? 'Kirim butuh koneksi internet' : kosong ? 'Tambahkan satu pekerjaan dulu' : data.can.submit === false ? 'Anda tidak bisa mengirim laporan ini' : undefined}
          loading={f.mengirim}
          loadingTitle="Mengirim…"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <Screen header={<SubAppBar title="Laporan hari ini" />} footer={footer} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
        <ScrollView ref={gulir} keyboardShouldPersistTaps="handled" contentContainerStyle={s.isi}>
          <View style={{ gap: 6 }}>
            <View style={s.barisAtas}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="overline">Laporan hari ini</Text>
                <Text variant="h2" accessibilityRole="header">
                  {tanggalLaporan(data.date)}
                </Text>
              </View>
              {lencana}
            </View>
            <View style={s.barisAtas}>
              <View style={[s.statusTombol, { flexShrink: 0 }]}>
                <Icon name={terkunci ? 'lock' : 'lock-open'} size={16} color={colors.muted} />
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {terkunci ? 'Terkunci' : `Terbuka sampai ${batasJam}`}
                </Text>
              </View>
              <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{statusTeks}</View>
            </View>
          </View>

          {terkunci ? (
            <Banner
              tone="bad"
              icon="lock"
              message={`Laporan ${tanggalSingkat(data.date).split(' ').slice(1).join(' ')} sudah terkunci (lewat ${batasJam}). Perubahan terakhir tidak tersimpan.`}
              actionLabel="Tulis laporan hari ini"
              onAction={() => void f.muatUlang()}
            />
          ) : null}
          {!terkunci && (data.holiday || !data.scheduled) ? (
            <Banner
              tone="info"
              icon="calendar-days"
              message={data.holiday ? `Hari ini ${data.holiday}. Laporan tetap boleh ditulis bila Anda bekerja.` : 'Hari ini tidak terjadwal kerja. Laporan tetap boleh ditulis bila Anda bekerja.'}
            />
          ) : null}
          {f.dipulihkan && !terkunci ? <Banner tone="info" icon="cloud-off" message="Isian yang belum tersimpan dipulihkan dari perangkat ini." /> : null}
          {hasilPindah && !terkunci ? <BannerHasil hasil={hasilPindah} /> : null}
          {galat.umum ? <Banner tone="bad" message={galat.umum} /> : null}

          <View style={s.barisAtas}>
            <Text variant="h3" accessibilityRole="header">
              Pekerjaan hari ini
            </Text>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {ringkasPekerjaan(isian.items.length, totalJam)}
            </Text>
          </View>
          {adaGalatCatatan ? <Banner tone="bad" message="Setiap pekerjaan butuh catatan progres." /> : null}

          {isian.items.length === 0 ? (
            <View style={{ gap: 8 }}>
              <EmptyState icon="clipboard-pen" title="Belum ada pekerjaan" description="Tambahkan minimal satu pekerjaan yang Anda kerjakan hari ini." />
              {galat.items ? (
                <Text variant="meta" tone="danger">
                  {galat.items}
                </Text>
              ) : null}
            </View>
          ) : (
            isian.items.map((item) => (
              <KartuItem
                key={item.kunci}
                item={item}
                opsi={item.taskId ? opsi[item.taskId] : undefined}
                terbuka={terbuka.has(item.kunci)}
                galat={galat}
                batasCatatan={batas.note}
                bacaSaja={bacaSaja}
                onBuka={() =>
                  setTerbuka((t) => {
                    const baru = new Set(t);
                    if (baru.has(item.kunci)) baru.delete(item.kunci);
                    else baru.add(item.kunci);
                    return baru;
                  })
                }
                onUbah={(patch) => f.ubahItem(item.kunci, patch)}
                onHapus={() => {
                  f.hapusItem(item.kunci);
                  snackbar.show({ message: `${item.taskKey ?? 'Pekerjaan lain'} dihapus dari laporan`, variant: 'info' });
                }}
                onPilihKolom={() => setKolomUntuk(item)}
              />
            ))
          )}
          {isian.items.length > 0 && galat.items ? (
            <Text variant="meta" tone="danger">
              {galat.items}
            </Text>
          ) : null}

          {bacaSaja ? null : (
            <>
              {saranChip.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <View style={s.barisAtas}>
                    <Text variant="title">Saran dari tugas Anda</Text>
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      Hari ini
                    </Text>
                  </View>
                  <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
                    {saranChip.map((o) => (
                      <Chip key={o.id} icon="plus" label={potong(`${o.key} ${o.title}`, 22)} onPress={() => tambahTugas(o)} disabled={penuh} />
                    ))}
                  </ChipScroller>
                </View>
              ) : null}
              <View style={s.duaTombol}>
                <Button title="Dari tugas" variant="tonal" icon="list-checks" onPress={() => setPilihTugas(true)} disabled={penuh} style={{ flex: 1 }} />
                <Button title="Di luar tugas" variant="outline" icon="pen-line" onPress={tambahDiLuar} disabled={penuh} style={{ flex: 1 }} />
              </View>
              {penuh ? (
                <Text variant="meta" tone="warning">
                  {`Maksimal ${batas.items} pekerjaan dalam satu laporan.`}
                </Text>
              ) : null}
            </>
          )}

          <Text variant="h3" accessibilityRole="header" style={{ marginTop: 8 }}>
            Ringkasan
          </Text>
          <Field label="Ringkasan hari ini" error={galat.summary ?? null}>
            <Input
              value={isian.ringkasan}
              onChangeText={(t) => f.ubahTeks('ringkasan', t)}
              placeholder="Hasil utama hari ini dalam beberapa kalimat"
              multiline
              maxLength={batas.text}
              editable={!bacaSaja}
              disabled={bacaSaja}
              invalid={galat.summary !== undefined}
              style={s.teksPanjang}
            />
          </Field>
          <Field label="Hambatan (opsional)" error={galat.blockers ?? null}>
            <Input
              value={isian.hambatan}
              onChangeText={(t) => f.ubahTeks('hambatan', t)}
              placeholder="Apa yang menghambat atau butuh bantuan"
              multiline
              maxLength={batas.text}
              editable={!bacaSaja}
              disabled={bacaSaja}
              invalid={galat.blockers !== undefined}
              style={s.teksPanjang}
            />
          </Field>
          <Field label="Catatan / notulensi (opsional)" error={galat.notes ?? null}>
            <Input
              value={isian.catatan}
              onChangeText={(t) => f.ubahTeks('catatan', t)}
              placeholder="Catatan bebas, mis. notulen rapat singkat"
              multiline
              maxLength={batas.text}
              editable={!bacaSaja}
              disabled={bacaSaja}
              invalid={galat.notes !== undefined}
              style={s.teksPanjang}
            />
          </Field>
          <Pressable onPress={() => router.push('/laporan' as never)} accessibilityRole="link" accessibilityLabel="Buka riwayat laporan harian" style={s.tautan} scaleTo={1}>
            <Icon name="history" size={18} color={colors.link} />
            <Text variant="label" tone="link">
              Riwayat laporan
            </Text>
          </Pressable>
        </ScrollView>
      </Screen>

      <PilihTugasSheet
        visible={pilihTugas}
        onClose={() => setPilihTugas(false)}
        saran={data.suggestions}
        sudahDipilih={dipilih}
        penuh={penuh}
        hariIni={data.date}
        onTambah={tambahTugas}
        onDiLuarTugas={tambahDiLuar}
      />
      <PindahkanKeSheet
        opsi={kolomUntuk?.taskId ? (opsi[kolomUntuk.taskId] ?? null) : null}
        pilihan={kolomUntuk ? (isian.items.find((i) => i.kunci === kolomUntuk.kunci)?.pindahKe ?? null) : null}
        onClose={() => setKolomUntuk(null)}
        onPilih={(id) => {
          if (kolomUntuk) f.ubahItem(kolomUntuk.kunci, { pindahKe: id });
          setKolomUntuk(null);
        }}
      />
      <Dialog
        visible={konfirmasi}
        title={terkirim ? 'Kirim ulang perubahan?' : 'Kirim laporan hari ini?'}
        onClose={f.mengirim ? undefined : () => setKonfirmasi(false)}
        actions={[
          { label: 'Periksa lagi', variant: 'quiet', onPress: () => setKonfirmasi(false), disabled: f.mengirim },
          { label: 'Kirim', onPress: () => void kirim(), loading: f.mengirim },
        ]}
      >
        <View style={{ gap: 12 }}>
          <BarisKonfirmasi icon="list-checks" teks={ringkasPekerjaan(isian.items.length, totalJam)} />
          {daftarPindah.length > 0 ? <BarisKonfirmasi icon="arrow-right-left" teks={kalimatPindah(daftarPindah)} /> : null}
          {isian.hambatan.trim() !== '' ? <BarisKonfirmasi icon="triangle-alert" teks="1 hambatan dilaporkan" /> : null}
          <View style={[s.catatanKonfirmasi, { backgroundColor: colors.surface2, borderLeftColor: colors.primary }]}>
            <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
              {`Atasan langsung dan Kepala Divisi bisa membacanya. Masih bisa diubah dan dikirim ulang sampai ${batasJam}.`}
            </Text>
          </View>
        </View>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  isi: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 },
  barisAtas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusTombol: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  duaTombol: { flexDirection: 'row', gap: 10 },
  teksPanjang: { minHeight: 104, textAlignVertical: 'top', paddingTop: 14 },
  barisKonfirmasi: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  catatanKonfirmasi: { borderLeftWidth: 4, borderRadius: 14, padding: 14 },
  tautan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 },
});
