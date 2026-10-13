/**
 * Detail pengajuan (mockup 04-pengajuan-persetujuan/13, 14, 15, 25, 26):
 * kepala jenis + status, catatan penolakan/revisi, pembatalan (oleh Anda /
 * oleh HR setelah disetujui + alasan), baris isian per jenis, lampiran,
 * peringatan rekan, timeline alur, aksi sesuai `can` (batal, lanjutkan /
 * hapus draf, revisi & kirim ulang, pembatalan HR), 404/403.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { batalkanPengajuan, detailPengajuan, hapusDraf, type DetailPengajuan } from '@/api/pengajuan';
import { BatalDisetujuiSheet, ringkasEfek } from '@/features/pengajuan/BatalDisetujuiSheet';
import { useBukaLampiran } from '@/features/pengajuan/Lampiran';
import { PeringatanRekan } from '@/features/pengajuan/Ringkasan';
import { TimelineAlur } from '@/features/pengajuan/Timeline';
import {
  META_KATEGORI,
  META_STATUS,
  angkaHari,
  durasiMenit,
  hariTanggalPanjang,
  hariTanggalPendek,
  jamKantor,
  jamSaja,
  jamTampil,
  judulDetail,
  rentangTanggal,
  rupiah,
  tanggalPendek,
  ukuranBerkas,
  ymdKantor,
} from '@/features/pengajuan/format';
import { tandaiDaftarBerubah } from '@/features/pengajuan/simpanan';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme } from '@/theme';
import { Badge, Banner, BottomSheet, Button, Card, ErrorState, Icon, IconTile, Loading, Pressable, Screen, SheetAction, Skeleton, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

function BarisInfo({ label, nilai, mono = false, terakhir = false }: { label: string; nilai: React.ReactNode; mono?: boolean; terakhir?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.baris, !terakhir && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <Text variant="body" tone="muted" style={s.labelBaris}>
        {label}
      </Text>
      {typeof nilai === 'string' ? (
        <Text variant={mono ? 'mono' : 'body'} weight={600} style={{ flex: 1 }}>
          {nilai}
        </Text>
      ) : (
        <View style={{ flex: 1 }}>{nilai}</View>
      )}
    </View>
  );
}

function barisIsian(d: DetailPengajuan, staf: boolean): { label: string; nilai: string; mono?: boolean }[] {
  const k = d.type.category;
  const p = d.payload;
  const hasil: { label: string; nilai: string; mono?: boolean }[] = [];
  if (k === 'procurement') {
    hasil.push({ label: 'Barang', nilai: p.item_name ?? '—' });
    hasil.push({ label: 'Jumlah', nilai: `${p.quantity ?? 0} ${p.unit || 'unit'}` });
    if (p.unit_price) {
      hasil.push({ label: 'Harga satuan', nilai: rupiah(p.unit_price) });
    }
    hasil.push({ label: 'Perkiraan total', nilai: p.total ? rupiah(p.total) : '—' });
    hasil.push({ label: 'Kebutuhan', nilai: p.urgency === 'mendesak' ? 'Mendesak' : 'Biasa' });
    if (p.reference_url) {
      hasil.push({ label: 'Tautan', nilai: p.reference_url });
    }
  } else {
    const satuHari = ymdKantor(d.start_at) === ymdKantor(d.end_at);
    hasil.push({ label: 'Tanggal', nilai: satuHari ? hariTanggalPanjang(d.start_at) : rentangTanggal(d.start_at, d.end_at) });
    if (jamSaja(d)) {
      hasil.push({ label: 'Jam', nilai: `${jamTampil(p.start_time) || jamKantor(d.start_at)}–${jamTampil(p.end_time) || jamKantor(d.end_at)} (${durasiMenit(d.minutes)})`, mono: true });
    }
    if (k === 'correction') {
      if (p.check_in) {
        hasil.push({ label: 'Jam masuk', nilai: jamTampil(p.check_in), mono: true });
      }
      if (p.check_out) {
        hasil.push({ label: 'Jam pulang', nilai: jamTampil(p.check_out), mono: true });
      }
    }
    if (k === 'business_trip' && p.destination) {
      hasil.push({ label: 'Tujuan', nilai: p.destination });
    }
    if (!jamSaja(d) && k !== 'correction' && d.days !== null && !satuHari) {
      hasil.push({ label: d.type.counts_calendar_days ? 'Hari' : 'Hari kerja', nilai: `${angkaHari(d.days)} hari${p.half_day ? ' (setengah hari)' : ''}` });
    } else if (p.half_day) {
      hasil.push({ label: 'Porsi', nilai: 'Setengah hari' });
    }
    if (!staf && d.balance) {
      hasil.push({
        label: 'Saldo cuti',
        nilai:
          d.status === 'canceled'
            ? `Dikembalikan ${angkaHari(d.days ?? 0)} hari`
            : d.status === 'approved'
              ? `Terpakai ${angkaHari(d.days ?? 0)} hari`
              : `${angkaHari(d.balance.before)} → ${angkaHari(d.balance.after)} hari`,
      });
    }
  }
  return hasil;
}

export default function LayarDetailPengajuan(): React.JSX.Element {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const staf = user?.is_staff_only ?? true;
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const buka = useBukaLampiran(id ?? null);

  const [detail, setDetail] = useState<DetailPengajuan | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheetHr, setSheetHr] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }
    setGalat(null);
    try {
      setDetail(await detailPengajuan(id));
    } catch (err) {
      setGalat(err instanceof ApiError ? err : new ApiError({ status: 500, message: 'Pengajuan tidak dapat dimuat.' }));
    } finally {
      setMemuat(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const batalkan = async (): Promise<void> => {
    if (!detail) {
      return;
    }
    const draf = detail.status === 'draft';
    const penyetuju = detail.waiting?.approver?.name;
    const ok = await dialog.confirm({
      title: draf ? 'Batalkan draf?' : 'Batalkan pengajuan?',
      message: draf
        ? 'Draf ini akan dibatalkan dan tidak bisa dikirim lagi.'
        : `${detail.number ?? 'Pengajuan ini'} akan dibatalkan dan tidak bisa diurungkan.${penyetuju ? ` ${penyetuju} tidak perlu memutuskannya lagi.` : ''}`,
      confirmLabel: 'Ya, batalkan',
      cancelLabel: 'Kembali',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setSibuk(true);
    try {
      setDetail(await batalkanPengajuan(detail.id));
      tandaiDaftarBerubah();
      snackbar.show({ message: draf ? 'Draf dibatalkan.' : 'Pengajuan dibatalkan. Penyetuju diberi tahu.', variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.errors.status?.[0] ?? err.message) : 'Pembatalan gagal. Coba lagi.', variant: 'bad' });
      if (err instanceof ApiError && err.status === 422) {
        void muat();
      }
    } finally {
      setSibuk(false);
    }
  };

  const hapus = async (): Promise<void> => {
    setMenu(false);
    if (!detail) {
      return;
    }
    const ok = await dialog.confirm({
      title: 'Hapus draf?',
      message: 'Draf dan lampirannya dihapus permanen dari RuangKerja.',
      confirmLabel: 'Hapus',
      cancelLabel: 'Kembali',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setSibuk(true);
    try {
      await hapusDraf(detail.id);
      tandaiDaftarBerubah();
      snackbar.show({ message: 'Draf dihapus.', variant: 'ok' });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/pengajuan');
      }
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.errors.status?.[0] ?? err.message) : 'Draf gagal dihapus.', variant: 'bad' });
    } finally {
      setSibuk(false);
    }
  };

  if (!detail) {
    return (
      <Screen header={<SubAppBar title="Pengajuan" />}>
        {galat ? (
          <ErrorState
            kind={errorKindFromStatus(galat.status)}
            title={galat.status === 404 ? 'Pengajuan tidak ditemukan' : galat.status === 403 ? 'Tidak ada akses' : 'Pengajuan tidak dapat dimuat'}
            message={
              galat.status === 404
                ? 'Pengajuan ini tidak ada atau tidak bisa Anda lihat.'
                : galat.status === 0
                  ? 'Periksa koneksi internet Anda lalu coba lagi.'
                  : galat.message
            }
            onRetry={galat.status === 404 || galat.status === 403 ? undefined : () => void muat()}
          />
        ) : memuat ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Skeleton width={52} height={52} radiusPx={16} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="40%" height={14} />
              </View>
            </View>
            <Loading rows={5} />
          </>
        ) : null}
      </Screen>
    );
  }

  const d = detail;
  const meta = META_KATEGORI[d.type.category];
  const status = META_STATUS[d.status];
  const milikSendiri = d.user.id === user?.id;
  const terkunci = d.type.locked;
  const catatan = d.decision_note?.note && (d.status === 'rejected' || d.status === 'revision_requested') ? d.decision_note : null;
  const c = d.cancellation;
  const isian = barisIsian(d, staf);

  const subJudul =
    d.status === 'draft'
      ? `Draf disimpan ${hariTanggalPendek(d.updated_at)} · ${jamKantor(d.updated_at)}`
      : `Diajukan ${hariTanggalPendek(d.submitted_at ?? d.created_at)}${d.round > 1 ? ` · putaran ${d.round}` : d.status === 'revision_requested' ? ' · putaran 1' : ` · ${jamKantor(d.submitted_at ?? d.created_at)}`}`;
  const statusTeks = d.status === 'pending' && d.step_position ? `${status.label} · langkah ${d.step_position}/${d.step_count}` : status.label;

  let footer: React.ReactNode = null;
  if (d.status === 'draft' && milikSendiri) {
    footer =
      terkunci || !d.can.edit ? (
        <Button title="Batalkan draf" variant="outline" icon="x" style={{ flex: 1 }} loading={sibuk} disabled={!d.can.cancel} onPress={() => void batalkan()} />
      ) : (
        <>
          {d.can.delete ? <Button title="Hapus" variant="outline" icon="trash-2" style={{ flex: 1 }} disabled={sibuk} onPress={() => void hapus()} /> : null}
          <Button title="Lanjutkan draf" icon="pencil" style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/pengajuan/form', params: { id: d.id } })} />
        </>
      );
  } else if (d.status === 'revision_requested' && milikSendiri) {
    footer = (
      <>
        {d.can.cancel ? <Button title="Batalkan" variant="outline" icon="x" style={{ flex: 1 }} loading={sibuk} onPress={() => void batalkan()} /> : null}
        {d.can.resubmit ? <Button title="Revisi & kirim ulang" icon="pencil" style={{ flex: 1.6 }} onPress={() => router.push({ pathname: '/pengajuan/form', params: { id: d.id } })} /> : null}
      </>
    );
  } else if (d.status === 'pending' && d.can.cancel) {
    footer = <Button title="Batalkan pengajuan" variant="outline" icon="x" style={{ flex: 1 }} loading={sibuk} onPress={() => void batalkan()} />;
  } else if (d.status === 'approved' && d.can.cancel_approved) {
    footer = <Button title="Batalkan pengajuan" variant="outline" icon="ban" style={{ flex: 1 }} onPress={() => setSheetHr(true)} />;
  }

  return (
    <Screen
      header={<SubAppBar title={d.number ?? 'Draf pengajuan'} actions={d.can.delete ? [{ icon: 'ellipsis-vertical', label: 'Menu lainnya', onPress: () => setMenu(true) }] : []} />}
      footer={footer}
      onRefresh={() => void muat()}
    >
      <View style={s.kepala}>
        <IconTile icon={meta.icon} tone={meta.tile} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" weight={700}>
            {milikSendiri ? judulDetail(d) : `${judulDetail(d)} · ${d.user.name}`}
          </Text>
          <Text variant="meta">{subJudul}</Text>
        </View>
      </View>
      <Badge tone={status.tone} dot>
        {statusTeks}
      </Badge>

      {terkunci && d.status === 'draft' ? (
        <View style={[s.kotakKunci, { borderColor: colors.borderStrong }]}>
          <Icon name="lock" size={20} color={colors.muted} />
          <Text variant="label" weight={500} tone="muted" style={{ flex: 1, lineHeight: 21 }}>
            <Text variant="label">Draf lama jenis terkunci. </Text>
            {d.type.locked_reason ?? ''} Draf ini tidak dapat diubah atau dikirim, hanya dibatalkan.
          </Text>
        </View>
      ) : null}

      {catatan ? (
        <View style={[s.kotak, { backgroundColor: d.status === 'rejected' ? colors.dangerSoft : colors.infoSoft }]}>
          <Icon name={d.status === 'rejected' ? 'message-square' : 'undo-2'} size={20} color={d.status === 'rejected' ? colors.danger : colors.info} />
          <Text variant="label" weight={500} style={{ flex: 1, lineHeight: 21, color: d.status === 'rejected' ? colors.danger : colors.info }}>
            <Text variant="label" style={{ color: d.status === 'rejected' ? colors.danger : colors.info }}>
              {`${catatan.by ?? 'Penyetuju'} ${d.status === 'rejected' ? 'menolak' : 'meminta revisi'}: `}
            </Text>
            “{catatan.note}”
          </Text>
        </View>
      ) : null}

      {d.status === 'canceled' && c ? (
        c.after_approval ? (
          <View style={[s.kotak, { backgroundColor: colors.dangerSoft }]}>
            <Icon name="ban" size={20} color={colors.danger} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" style={{ color: colors.danger }}>
                Dibatalkan setelah disetujui
              </Text>
              <Text variant="label" weight={500} style={{ color: colors.danger, lineHeight: 21 }}>
                Oleh {c.by?.name ?? 'HR'} · {tanggalPendek(c.at)}, {jamKantor(c.at)}. Saldo dan absensi terkait sudah disesuaikan.
              </Text>
              {c.reason ? (
                <Text variant="label" weight={500} style={{ color: colors.danger, lineHeight: 21 }}>
                  Alasan: “{c.reason}”
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Banner tone="neutral" icon="ban" message={`Dibatalkan oleh ${c.by_requester ? (milikSendiri ? 'Anda' : d.user.name) : (c.by?.name ?? 'HR')} · ${tanggalPendek(c.at)}, ${jamKantor(c.at)}.`} />
        )
      ) : null}

      <Card style={{ padding: 0, gap: 0 }}>
        {isian.map((b) => (
          <BarisInfo key={b.label} label={b.label} nilai={b.nilai} mono={b.mono} />
        ))}
        <BarisInfo
          label="Alasan"
          nilai={d.health_details_hidden ? 'Detail kesehatan disembunyikan untuk penyetuju pengganti.' : d.reason || '—'}
          terakhir={!d.substitute}
        />
        {d.substitute ? <BarisInfo label="Pengganti" nilai={d.substitute.name} terakhir /> : null}
      </Card>

      {d.attachments.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="label">Lampiran</Text>
          {d.attachments.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => void buka({ jenis: 'server', kunci: a.id, data: a })}
              accessibilityRole="button"
              accessibilityLabel={`Buka ${a.filename}`}
              style={[s.lampiran, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[s.mini, { backgroundColor: colors.surface2 }]}>
                <Icon name={a.mime_type.startsWith('image/') ? 'file-image' : 'file-text'} size={22} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {a.filename}
                </Text>
                <Text variant="meta">{ukuranBerkas(a.size_bytes)}</Text>
              </View>
              <Icon name="external-link" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {d.colleagues && d.colleagues.people.length > 0 && d.status === 'pending' ? (
        <PeringatanRekan rekan={d.colleagues} akhiran="Atasan melihat info ini saat memutuskan." />
      ) : null}

      {d.status !== 'draft' ? (
        <View style={{ gap: 12 }}>
          <Text variant="label">Alur persetujuan</Text>
          <TimelineAlur detail={d} diriSendiri={milikSendiri} />
        </View>
      ) : null}

      {d.status === 'approved' && !d.can.cancel_approved && milikSendiri ? (
        <Text variant="meta">Pengajuan yang sudah disetujui hanya bisa dibatalkan oleh HR. Hubungi HR bila rencana berubah.</Text>
      ) : null}

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Pengajuan">
        {d.can.delete ? <SheetAction icon="trash-2" label="Hapus draf" description="Draf dan lampirannya dihapus permanen" tone="danger" onPress={() => void hapus()} /> : null}
        {d.can.cancel ? (
          <SheetAction
            icon="x"
            label="Batalkan"
            onPress={() => {
              setMenu(false);
              void batalkan();
            }}
          />
        ) : null}
      </BottomSheet>

      {d.can.cancel_approved ? (
        <BatalDisetujuiSheet
          detail={d}
          visible={sheetHr}
          onClose={() => setSheetHr(false)}
          onSelesai={(hasil) => {
            setSheetHr(false);
            setDetail(hasil.request);
            tandaiDaftarBerubah();
            snackbar.show({ message: ringkasEfek(hasil.effects, hasil.request), variant: 'ok', duration: 8000 });
          }}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baris: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'flex-start' },
  labelBaris: { width: 110, fontSize: 16 },
  kotak: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg },
  kotakKunci: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  lampiran: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.lg, padding: 10, minHeight: 64 },
  mini: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
