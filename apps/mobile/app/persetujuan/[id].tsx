/**
 * Detail persetujuan — mockup 04: 19 (cuti/koreksi), 20 (barang, sakit
 * penyetuju pengganti/asli), 21 (sudah diputus, konflik 409, offline, memuat,
 * tidak ditemukan), 22 (sheet Tolak/Revisi). Keputusan di layar ini dikirim
 * langsung (dengan catatan opsional) lalu pindah ke `next_id`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { GalatLampiran, putuskan, unduhLampiran, type DetailPengajuan, type LampiranPengajuan } from '@/api/persetujuan';
import { LencanaMewakili, PeringatanRekan, nadaLangkah } from '@/features/persetujuan/BagianKartu';
import { angkaHari, durasi, jamTitik, judulKeputusan, namaDepan, rentangTanggalPanjang, rupiah, tanggalBerhari, tanggalSingkat } from '@/features/persetujuan/format';
import { bukaDetailPengajuan } from '@/features/persetujuan/nav';
import { SheetKeputusan, type JenisSheet } from '@/features/persetujuan/SheetKeputusan';
import { TimelinePersetujuan } from '@/features/persetujuan/Timeline';
import { lupakanDetail, useDetailPersetujuan } from '@/features/persetujuan/useDetail';
import { useSession } from '@/session/SessionProvider';
import { fontFamily, radius, useTheme } from '@/theme';
import { Avatar, Badge, Banner, Button, ErrorState, Field, Icon, Input, Loading, Pressable, Screen, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

function ukuranBerkas(b: number): string {
  if (b <= 0) {
    return '';
  }
  if (b < 1024 * 1024) {
    return `${Math.max(1, Math.round(b / 1024))} KB`;
  }
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(b / (1024 * 1024))} MB`;
}

function Baris({ label, children, akhir = false }: { label: string; children: React.ReactNode; akhir?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.baris, !akhir ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider } : null]}>
      <Text variant="body" tone="muted" style={{ width: 112, fontSize: 16 }}>
        {label}
      </Text>
      <View style={{ flex: 1, gap: 6 }}>
        {typeof children === 'string' ? (
          <Text variant="body" weight={600} style={{ fontSize: 16 }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

function Tersembunyi(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Icon name="shield-off" size={18} color={colors.muted} style={{ marginTop: 2 }} />
      <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 16 }}>
        Detail kesehatan disembunyikan untuk penyetuju pengganti
      </Text>
    </View>
  );
}

function teksTebal(teks: string): React.JSX.Element {
  return (
    <Text variant="body" weight={600} style={{ fontSize: 16 }}>
      {teks}
    </Text>
  );
}

function BarisRincian({ r, onLampiran, mengunduh }: { r: DetailPengajuan; onLampiran: (l: LampiranPengajuan) => void; mengunduh: string | null }): React.JSX.Element {
  const { colors } = useTheme();
  const mono = { fontFamily: fontFamily.mono600 };
  const kat = r.type.category;
  const baris: { label: string; isi: React.ReactNode }[] = [];
  if (kat === 'correction') {
    baris.push({ label: 'Tanggal', isi: tanggalBerhari(r.payload.date ?? r.start_at) });
    if (r.payload.check_in) {
      baris.push({ label: 'Jam masuk', isi: <Text variant="body" weight={600} style={[{ fontSize: 16 }, mono]}>{jamTitik(r.payload.check_in)}</Text> });
    }
    if (r.payload.check_out) {
      baris.push({ label: 'Jam pulang', isi: <Text variant="body" weight={600} style={[{ fontSize: 16 }, mono]}>{jamTitik(r.payload.check_out)}</Text> });
    }
  } else if (kat === 'procurement') {
    baris.push({ label: 'Barang', isi: r.payload.item_name ?? '—' });
    baris.push({ label: 'Jumlah', isi: durasi(r) ?? '—' });
    baris.push({ label: 'Harga satuan', isi: rupiah(r.payload.unit_price) });
    baris.push({
      label: 'Perkiraan total',
      isi: (
        <Text variant="body" weight={800} style={{ fontSize: 17 }}>
          {rupiah(r.payload.total)}
        </Text>
      ),
    });
    baris.push({ label: 'Kebutuhan', isi: <Badge tone={r.payload.urgency === 'mendesak' ? 'danger' : 'neutral'}>{r.payload.urgency === 'mendesak' ? 'Mendesak' : 'Biasa'}</Badge> });
    if (r.payload.reference_url) {
      const url = r.payload.reference_url;
      baris.push({
        label: 'Tautan',
        isi: (
          <Pressable onPress={() => void Linking.openURL(url).catch(() => undefined)} accessibilityRole="link" style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text variant="body" tone="link" weight={600} numberOfLines={2} style={{ fontSize: 16, textDecorationLine: 'underline' }}>
              {url}
            </Text>
          </Pressable>
        ),
      });
    }
    baris.push({ label: 'Tanggal', isi: tanggalSingkat(r.submitted_at ?? r.start_at) });
  } else if (r.minutes !== null && r.minutes !== undefined) {
    baris.push({ label: 'Tanggal', isi: tanggalBerhari(r.start_at) });
    baris.push({ label: 'Jam', isi: <Text variant="body" weight={600} style={[{ fontSize: 16 }, mono]}>{`${jamTitik(r.start_at)}–${jamTitik(r.end_at)}`}</Text> });
    baris.push({ label: 'Durasi', isi: durasi(r) ?? '—' });
  } else {
    baris.push({ label: 'Tanggal', isi: rentangTanggalPanjang(r.start_at, r.end_at) });
    if (r.days !== null) {
      const kerja = r.type.category === 'leave' && !r.type.counts_calendar_days;
      const ekor = [kerja ? ' (tanpa libur)' : r.type.counts_calendar_days ? ' kalender' : '', r.payload.half_day ? ' · setengah hari' : ''].join('');
      baris.push({
        label: kerja ? 'Hari kerja' : 'Durasi',
        isi: (
          <Text variant="body" weight={600} style={{ fontSize: 16 }}>
            {`${angkaHari(r.days)} hari`}
            {ekor ? (
              <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
                {ekor}
              </Text>
            ) : null}
          </Text>
        ),
      });
    }
    if (r.payload.destination) {
      baris.push({ label: 'Tujuan', isi: r.payload.destination });
    }
  }
  if (r.balance) {
    baris.push({
      label: 'Saldo cuti',
      isi: (
        <Text variant="body" style={{ fontSize: 16 }}>
          <Text variant="body" weight={700} style={{ fontSize: 16 }}>{`${angkaHari(r.balance.before)} → ${angkaHari(r.balance.after)} hari`}</Text>
          <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
            {' setelah disetujui'}
          </Text>
        </Text>
      ),
    });
  }
  baris.push({
    label: 'Alasan',
    isi: r.health_details_hidden ? (
      <Tersembunyi />
    ) : r.reason.trim() !== '' ? (
      teksTebal(r.reason.trim())
    ) : (
      <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
        —
      </Text>
    ),
  });
  if (r.substitute) {
    const pengganti = r.substitute;
    baris.push({
      label: 'Pengganti',
      isi: (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={pengganti.name} size="sm" />
          <Text variant="body" weight={600} style={{ flex: 1, fontSize: 16 }}>
            {pengganti.name}
          </Text>
        </View>
      ),
    });
  }
  baris.push({
    label: 'Lampiran',
    isi: r.health_details_hidden ? (
      <Tersembunyi />
    ) : r.attachments.length === 0 ? (
      <Text variant="body" style={{ fontSize: 16 }}>
        Tidak ada
      </Text>
    ) : (
      <View style={{ gap: 6 }}>
        {r.attachments.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => onLampiran(l)}
            disabled={mengunduh !== null}
            accessibilityRole="button"
            accessibilityLabel={`Buka lampiran ${l.filename}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
          >
            <Icon name={l.mime_type.startsWith('image/') ? 'image' : 'file-text'} size={20} color={colors.link} />
            <View style={{ flex: 1 }}>
              <Text variant="body" tone="link" weight={600} numberOfLines={1} style={{ fontSize: 16 }}>
                {mengunduh === l.id ? 'Mengunduh…' : l.filename}
              </Text>
              {ukuranBerkas(l.size_bytes) ? <Text variant="meta">{ukuranBerkas(l.size_bytes)}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
    ),
  });
  return (
    <View style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {baris.map((b, i) => (
        <Baris key={b.label} label={b.label} akhir={i === baris.length - 1}>
          {b.isi}
        </Baris>
      ))}
    </View>
  );
}

export default function DetailPersetujuanLayar(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const detail = useDetailPersetujuan(id ?? null);
  const [catatan, setCatatan] = useState('');
  const [sheet, setSheet] = useState<JenisSheet | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [mengunduh, setMengunduh] = useState<string | null>(null);

  const data = detail.data?.request.id === id ? detail.data : null;
  const offline = detail.galatStatus === 0;

  const lanjut = (nextId: string | null): void => {
    if (nextId && nextId !== id) {
      router.replace(`/persetujuan/${nextId}` as never);
    } else {
      router.back();
    }
  };

  const konflik = async (err: ApiError): Promise<void> => {
    setSheet(null);
    if (id) {
      lupakanDetail(id);
    }
    const keDaftar = await dialog.confirm({ title: 'Sudah diputuskan', message: `${err.message} Daftar persetujuan Anda diperbarui.`, confirmLabel: 'Ke daftar', cancelLabel: 'Lihat pengajuan' });
    if (keDaftar) {
      router.back();
    } else {
      void detail.muatUlang();
    }
  };

  const setujui = async (): Promise<void> => {
    if (!data || mengirim) {
      return;
    }
    setMengirim(true);
    try {
      const hasil = await putuskan(data.request.id, 'setujui', catatan);
      lupakanDetail(data.request.id);
      snackbar.show({ message: `${judulKeputusan(data.request)} disetujui.`, variant: 'ok' });
      lanjut(hasil.next_id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        void konflik(err);
      } else if (err instanceof ApiError && err.status === 0) {
        snackbar.show({ message: 'Tidak ada koneksi. Persetujuan belum terkirim.', variant: 'offline' });
      } else {
        snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Persetujuan gagal dikirim.', variant: 'bad' });
      }
    } finally {
      setMengirim(false);
    }
  };

  const bukaLampiran = async (l: LampiranPengajuan): Promise<void> => {
    if (!data) {
      return;
    }
    setMengunduh(l.id);
    try {
      const berkas = await unduhLampiran(data.request.id, l);
      await Linking.openURL(berkas.contentUri).catch(() =>
        snackbar.show({ message: 'Tidak ada aplikasi untuk membuka berkas ini. Pasang penampil PDF/gambar lalu coba lagi.', variant: 'warn', duration: 7000 }),
      );
    } catch (err) {
      snackbar.show({ message: err instanceof GalatLampiran ? err.message : 'Lampiran gagal diunduh.', variant: err instanceof GalatLampiran && err.status === 0 ? 'offline' : 'bad' });
    } finally {
      setMengunduh(null);
    }
  };

  const judulBar = data?.request.number ?? 'Detail persetujuan';

  if (!data) {
    const hilang = detail.galatStatus === 404 || detail.galatStatus === 403;
    return (
      <Screen header={<SubAppBar title={judulBar} onBack={() => router.back()} />}>
        {detail.memuat || !detail.galat ? (
          <Loading rows={6} label="Memuat pengajuan…" />
        ) : (
          <ErrorState
            kind={errorKindFromStatus(detail.galatStatus)}
            title={hilang ? 'Pengajuan tidak ditemukan' : undefined}
            message={hilang ? 'Pengajuan ini tidak ada atau Anda tidak lagi berhak melihatnya.' : (detail.galat ?? 'Tidak dapat memuat pengajuan.')}
            onRetry={() => void detail.muatUlang()}
          />
        )}
      </Screen>
    );
  }

  const r = data.request;
  const giliran = data.my_step !== null && r.can.approve !== false;
  const mewakili = data.my_step?.on_behalf_of ?? null;
  const nama = namaDepan(r.user.name);
  const posisi = data.queue.position !== null && data.queue.total > 0 ? `${data.queue.position} dari ${data.queue.total}` : null;
  const status = giliran
    ? { tone: 'warning' as const, label: 'Menunggu Anda' }
    : data.my_decision
      ? { tone: nadaLangkah(data.my_decision.status), label: `Anda: ${data.my_decision.status_label}` }
      : { tone: r.status === 'approved' ? ('success' as const) : r.status === 'rejected' ? ('danger' as const) : r.status === 'pending' ? ('warning' as const) : ('neutral' as const), label: r.status_label };
  const sub = [r.user.position, `diajukan ${tanggalBerhari(r.submitted_at ?? r.created_at)}`].filter(Boolean).join(' · ');
  const alasanOff = offline ? 'Tidak ada koneksi' : undefined;

  const footer = giliran ? (
    <>
      <Button title="Minta revisi" variant="quiet" style={{ flex: 1 }} disabled={offline || mengirim} disabledReason={alasanOff} onPress={() => setSheet('revisi')} />
      <Button title="Tolak" variant="outline" style={{ flex: 1 }} disabled={offline || mengirim} disabledReason={alasanOff} onPress={() => setSheet('tolak')} />
      <Button title="Setujui" icon="check" style={{ flex: 1.2 }} loading={mengirim} loadingTitle="Mengirim…" disabled={offline} disabledReason={alasanOff} onPress={() => void setujui()} />
    </>
  ) : undefined;

  return (
    <Screen header={<SubAppBar title={judulBar} onBack={() => router.back()} />} onRefresh={() => void detail.muatUlang()} refreshing={false} footer={footer}>
      {offline ? (
        <Banner tone="warn" icon="cloud-off" title="Offline." message="Menampilkan data terakhir. Menyetujui dan menolak dimatikan sampai tersambung." actionLabel="Coba lagi" onAction={() => void detail.muatUlang()} />
      ) : null}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Avatar name={r.user.name} size="lg" />
          {posisi ? (
            <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
              {posisi}
            </Text>
          ) : null}
        </View>
        <Text variant="h2" accessibilityRole="header">{`${r.type.name} · ${r.user.name}`}</Text>
        <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
          {sub}
          <Text variant="body" tone="muted" style={{ fontSize: 15, fontFamily: fontFamily.mono500 }}>{` · ${jamTitik(r.submitted_at ?? r.created_at)}`}</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Badge tone={status.tone}>{status.label}</Badge>
          {mewakili ? <LencanaMewakili nama={mewakili.name} /> : null}
        </View>
      </View>
      {mewakili ? <Banner tone="info" icon="user-cog" message={`Anda menerima delegasi dari ${mewakili.name}. Keputusan Anda tercatat atas nama Anda, atas delegasi ${namaDepan(mewakili.name)}.`} /> : null}
      {data.my_decision && !giliran ? (
        <Banner
          tone={data.my_decision.status === 'approved' ? 'ok' : data.my_decision.status === 'rejected' ? 'bad' : 'info'}
          message={`Anda: ${data.my_decision.status_label} · ${tanggalBerhari(data.my_decision.decided_at)}.${data.my_decision.note ? ` Catatan: “${data.my_decision.note}”` : ''}`}
        />
      ) : null}
      {r.cancellation ? (
        <Banner
          tone="neutral"
          icon="circle-x"
          message={`Dibatalkan${r.cancellation.by_requester ? ' oleh pemohon' : r.cancellation.by ? ` oleh ${r.cancellation.by.name}` : ''} · ${tanggalBerhari(r.cancellation.at)}.${r.cancellation.reason ? ` Alasan: “${r.cancellation.reason}”` : ''}`}
        />
      ) : null}
      <BarisRincian r={r} onLampiran={(l) => void bukaLampiran(l)} mengunduh={mengunduh} />
      <PeringatanRekan rekan={r.colleagues} />
      <View style={{ gap: 12 }}>
        <Text variant="title" weight={700}>
          Alur persetujuan
        </Text>
        <TimelinePersetujuan request={r} sayaId={user?.id ?? null} />
      </View>
      {giliran ? (
        <Field label="Catatan untuk pemohon (opsional bila menyetujui)" hint={`Terlihat oleh ${nama} dan HR.`} counter={`${catatan.length} / 1000`}>
          <Input value={catatan} onChangeText={setCatatan} multiline textAlignVertical="top" maxLength={1000} placeholder="Wajib diisi bila menolak atau meminta revisi" accessibilityLabel="Catatan untuk pemohon" />
        </Field>
      ) : null}
      {r.can.cancel_approved && r.status === 'approved' ? (
        <View style={{ gap: 8 }}>
          <Banner tone="info" message="Pengajuan yang sudah disetujui bisa dibatalkan HR dengan alasan wajib. Saldo dan absensi dikembalikan." />
          <Button title="Batalkan pengajuan" variant="outline" icon="circle-x" onPress={() => bukaDetailPengajuan(r.id)} />
        </View>
      ) : null}
      {!giliran && r.status === 'pending' && !data.my_decision ? (
        <Text variant="meta" align="center" style={{ fontSize: 14 }}>
          {r.waiting ? `Menunggu ${r.waiting.approver?.name ?? r.waiting.label}.` : 'Belum giliran Anda.'}
        </Text>
      ) : null}
      <SheetKeputusan
        jenis={sheet}
        item={sheet ? r : null}
        catatanAwal={catatan}
        offline={offline}
        onClose={() => setSheet(null)}
        onSelesai={(hasil, jenis) => {
          setSheet(null);
          lupakanDetail(r.id);
          snackbar.show({ message: jenis === 'tolak' ? `${judulKeputusan(r)} ditolak.` : `Revisi diminta dari ${r.user.name}.`, variant: jenis === 'tolak' ? 'info' : 'ok' });
          lanjut(hasil.next_id);
        }}
        onKonflik={(err) => void konflik(err)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  kartu: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  baris: { flexDirection: 'row', gap: 12, paddingVertical: 16, paddingHorizontal: 18, alignItems: 'flex-start' },
});

