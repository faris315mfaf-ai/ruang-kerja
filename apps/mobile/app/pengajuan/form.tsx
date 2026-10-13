/**
 * Form pengajuan per jenis (mockup 04-pengajuan-persetujuan 03, 04, 06, 08,
 * 09, 10, 11-3, 12, 15-3): izin per jam/per hari, sakit + surat, koreksi
 * absensi, dinas luar, pengajuan barang; cuti & lembur tampil terkunci.
 * Param: `tipe` (id jenis) atau `jenis` (kode/slug), `tanggal` (pintu koreksi
 * dari Absensi), `id` (ubah draf / revisi & kirim ulang).
 */
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { batalkanPengajuan, type JenisForm } from '@/api/pengajuan';
import { InputJam } from '@/features/pengajuan/InputJam';
import { KolomLampiran } from '@/features/pengajuan/Lampiran';
import { PemilihPengganti } from '@/features/pengajuan/PemilihPengganti';
import { KartuRingkasan, teksAlur } from '@/features/pengajuan/Ringkasan';
import { META_KATEGORI, hariTanggalSingkat, isoDariYmd, rupiah, ribuan } from '@/features/pengajuan/format';
import { isianAktif } from '@/features/pengajuan/nilaiForm';
import { setTerkirim, tandaiDaftarBerubah } from '@/features/pengajuan/simpanan';
import { useFormPengajuan, type ParamForm } from '@/features/pengajuan/useFormPengajuan';
import { layout, radius, useTheme } from '@/theme';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  DateInput,
  ErrorState,
  Field,
  Glass,
  Icon,
  IconButton,
  Input,
  ListRow,
  Loading,
  Pressable,
  Screen,
  SegmentedTabs,
  SelectField,
  Switch,
  Tag,
  Text,
  errorKindFromStatus,
  tanggal,
  useDialog,
  useSnackbar,
} from '@/ui';

function KepalaForm({ judul, kanan, onTutup }: { judul: string; kanan: React.ReactNode; onTutup: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Glass style={{ paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, borderWidth: 0 }}>
      <View style={[s.kepala, { height: layout.appBar }]}>
        <IconButton icon="x" label="Tutup form" variant="ghost" onPress={onTutup} />
        <Text variant="title" weight={700} numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
          {judul}
        </Text>
        {kanan}
      </View>
    </Glass>
  );
}

function StatusSimpan({ teks }: { teks: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.statusSimpan} accessibilityLabel={teks}>
      <View style={[s.titik, { backgroundColor: colors.success }]} />
      <Text variant="meta" weight={600}>
        {teks}
      </Text>
    </View>
  );
}

function labelAlasan(kategori: JenisForm['category']): string {
  return kategori === 'business_trip' ? 'Alasan / kegiatan' : kategori === 'procurement' ? 'Alasan / kebutuhan' : 'Alasan';
}

export default function LayarFormPengajuan(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const navigation = useNavigation();
  const raw = useLocalSearchParams<{ tipe?: string; jenis?: string; tanggal?: string; id?: string; asal?: string }>();
  const param = useMemo<ParamForm>(
    () => ({ tipe: raw.tipe || undefined, jenis: raw.jenis || undefined, tanggal: raw.tanggal || undefined, id: raw.id || undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parameter rute tetap selama layar hidup
    [],
  );
  const f = useFormPengajuan(param);
  const [sheetKeluar, setSheetKeluar] = useState(false);
  const [sheetTipe, setSheetTipe] = useState(false);
  const aksiTertunda = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const lewati = useRef(false);

  const jenis = f.jenis;
  const n = f.nilai;
  const kategori = jenis?.category ?? null;
  const tidakBerhak = jenis !== null && !jenis.eligible;
  const bisaKirim = !f.terkunci && !tidakBerhak && !f.luring;
  const dariAbsensi = raw.asal === 'absensi' || (!!param.tanggal && kategori === 'correction' && !param.id);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (lewati.current || !f.kotor || f.terkunci) {
        return;
      }
      e.preventDefault();
      aksiTertunda.current = e.data.action;
      setSheetKeluar(true);
    });
  }, [navigation, f.kotor, f.terkunci]);

  const keluar = (): void => {
    const aksi = aksiTertunda.current;
    lewati.current = true;
    setSheetKeluar(false);
    if (aksi) {
      navigation.dispatch(aksi);
    } else {
      router.back();
    }
  };

  const tutup = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/pengajuan');
    }
  };

  const kirim = async (): Promise<void> => {
    const hasil = await f.kirim();
    if (hasil.ok) {
      lewati.current = true;
      setTerkirim(hasil.item);
      router.replace({ pathname: '/pengajuan/terkirim', params: { id: hasil.item.id } });
    }
  };

  const simpan = async (): Promise<void> => {
    const ok = await f.simpanDraf();
    if (ok) {
      snackbar.show({
        message: f.luring && !f.requestId ? 'Draf tersimpan di perangkat ini.' : 'Draf tersimpan.',
        variant: 'ok',
        actionLabel: 'Lihat',
        onAction: () => {
          lewati.current = true;
          router.replace('/pengajuan');
        },
      });
    }
  };

  const batalDrafTerkunci = async (): Promise<void> => {
    if (!f.requestId) {
      return;
    }
    const ok = await dialog.confirm({
      title: 'Batalkan draf?',
      message: 'Draf jenis yang dikunci tidak bisa dikirim. Draf ini akan dibatalkan.',
      confirmLabel: 'Ya, batalkan',
      cancelLabel: 'Kembali',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await batalkanPengajuan(f.requestId);
      tandaiDaftarBerubah();
      lewati.current = true;
      router.replace(`/pengajuan/${f.requestId}`);
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Draf gagal dibatalkan.', variant: 'bad' });
    }
  };

  // ── Keadaan muat ──────────────────────────────────────────────────────────
  if (f.memuat || f.galatMuat || !jenis || !f.dataJenis) {
    return (
      <Screen header={<KepalaForm judul="Pengajuan" kanan={null} onTutup={tutup} />}>
        {f.memuat ? (
          <Loading rows={6} />
        ) : f.galatMuat ? (
          <ErrorState
            kind={errorKindFromStatus(f.galatMuat.status)}
            title={f.galatMuat.status === 404 ? 'Pengajuan tidak ditemukan' : 'Form tidak dapat dimuat'}
            message={f.galatMuat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : f.galatMuat.message}
            onRetry={() => void f.muat()}
          />
        ) : (
          <ErrorState kind="notfound" title="Jenis pengajuan tidak tersedia" message="Jenis ini tidak aktif untuk perusahaan Anda. Pilih jenis lain." onRetry={() => router.replace('/pengajuan/baru')} />
        )}
      </Screen>
    );
  }

  const meta = META_KATEGORI[jenis.category];
  const aktif = new Set(isianAktif(jenis, n.mode));
  const mati = f.terkunci || tidakBerhak;
  const batas = f.dataJenis.limits;
  const hariIni = f.dataJenis.today;
  const satuHari = n.end_date === '' || n.end_date === n.start_date;
  const jenisTerkunci = jenis.locked || f.terkunciServer !== null;
  const alasanKunci = f.terkunciServer ?? jenis.locked_reason ?? 'Jenis ini sedang dikunci HR.';
  const minKoreksi = jenis.max_backdate_days !== null && kategori === 'correction' ? tanggal.toIso(tambahHari(hariIni, -jenis.max_backdate_days)) : undefined;
  const wajibLampiran = f.pratinjau?.attachment_required ?? false;
  const totalBarang = Number(n.quantity || 0) * Number(n.unit_price || 0);
  const alur = f.pratinjau ? teksAlur(f.pratinjau.flow) : '';
  const judul = f.revisi ? `Revisi ${jenis.name.toLowerCase()}` : jenis.name;

  const kanan = f.revisi ? (
    <Text variant="meta" weight={600} style={{ paddingRight: 8 }}>
      Putaran {(f.detail?.round ?? 1) + 1}
    </Text>
  ) : jenisTerkunci ? (
    <View style={{ paddingRight: 8 }}>
      <Tag tone="neutral">Terkunci</Tag>
    </View>
  ) : f.disimpanPada ? (
    <StatusSimpan teks={`Draf tersimpan ${f.disimpanPada}`} />
  ) : null;

  const tombolKirim = f.revisi ? 'Kirim ulang' : 'Kirim pengajuan';

  const footer = (
    <View style={{ flex: 1, gap: 8 }}>
      {alur && !mati ? (
        <Text variant="meta" align="center" numberOfLines={1}>
          {alur}
        </Text>
      ) : null}
      {mati && f.requestId && f.detail?.status === 'draft' ? (
        <Button title="Batalkan draf" variant="outline" icon="x" onPress={() => void batalDrafTerkunci()} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!mati ? (
            <Button title="Simpan draf" variant="outline" style={{ flex: 1 }} loading={f.menyimpan} disabled={f.mengirim} onPress={() => void simpan()} />
          ) : null}
          <Button
            title={tombolKirim}
            style={{ flex: 1.4 }}
            loading={f.mengirim}
            loadingTitle="Mengirim…"
            disabled={!bisaKirim || f.menyimpan}
            disabledReason={f.luring ? 'Pengiriman butuh koneksi internet' : mati ? alasanKunci : undefined}
            onPress={() => void kirim()}
          />
        </View>
      )}
    </View>
  );

  return (
    <Screen header={<KepalaForm judul={judul} kanan={kanan} onTutup={tutup} />} footer={footer}>
      {f.banner ? <Banner tone={f.banner.tone} title={f.banner.judul} message={f.banner.pesan} /> : null}
      {!f.banner && f.luring ? (
        <Banner tone="warn" icon="wifi-off" title="Anda sedang offline." message="Draf tetap tersimpan di perangkat. Pengiriman butuh koneksi." actionLabel="Coba lagi" onAction={() => void f.segarkanPratinjau()} />
      ) : null}
      {f.dipulihkan ? (
        <Banner tone="info" icon="history" title="Draf dipulihkan dari perangkat ini." message="Isian terakhir Anda dikembalikan." actionLabel="Buang draf" onAction={() => void f.buangDrafPerangkat()} />
      ) : null}
      {f.revisi && f.detail?.decision_note?.note ? (
        <Banner tone="info" icon="undo-2" title={`${f.detail.decision_note.by ?? 'Penyetuju'} meminta revisi:`} message={`“${f.detail.decision_note.note}”`} />
      ) : null}
      {dariAbsensi && n.date ? (
        <Banner tone="info" title="Dari Absensi:" message={`koreksi untuk ${hariTanggalSingkat(isoDariYmd(n.date))}. Isi jam yang benar lalu kirim ke atasan.`} />
      ) : null}
      {jenisTerkunci ? (
        <View style={[s.kunci, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
          <Icon name="lock" size={20} color={colors.muted} />
          <Text variant="label" weight={500} tone="muted" style={{ flex: 1, lineHeight: 21 }}>
            <Text variant="label">{`${meta.label} dikunci. `}</Text>
            {alasanKunci} {f.requestId ? 'Draf ini tidak dapat diubah atau dikirim, hanya dibatalkan.' : 'Form tidak dapat dikirim.'}
          </Text>
        </View>
      ) : null}
      {tidakBerhak && !jenisTerkunci ? <Banner tone="warn" icon="lock" message={jenis.ineligible_reason ?? `Anda belum berhak atas ${jenis.name}.`} /> : null}

      <View style={s.barisTag}>
        <Tag tone={meta.tag}>{meta.label}</Tag>
        {!f.requestId ? (
          <Pressable onPress={() => router.replace('/pengajuan/baru')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text variant="label" tone="link">
              Ganti jenis
            </Text>
          </Pressable>
        ) : null}
      </View>

      {f.pilihanTipe.length > 1 ? (
        <Field label={`Jenis ${meta.label.toLowerCase()}`}>
          <SelectField value={jenis.name} onPress={() => setSheetTipe(true)} disabled={!!f.requestId} accessibilityLabel="Jenis pengajuan" />
        </Field>
      ) : null}

      {jenis.modes ? (
        <Field label="Durasi izin">
          <SegmentedTabs
            value={n.mode}
            options={[
              { value: 'hours', label: 'Per jam' },
              { value: 'days', label: 'Per hari' },
            ]}
            onChange={(m) => {
              if (!mati) {
                f.ubah('mode', m);
              }
            }}
          />
        </Field>
      ) : null}

      {aktif.has('start_date') ? (
        <DateInput label="Tanggal mulai" value={n.start_date} onChange={(v) => f.ubah('start_date', v)} required error={f.galat.start_date} disabled={mati} />
      ) : null}
      {aktif.has('end_date') ? (
        <DateInput
          label="Tanggal selesai"
          value={n.end_date}
          onChange={(v) => f.ubah('end_date', v)}
          min={n.start_date || undefined}
          error={f.galat.end_date}
          hint={kategori === 'business_trip' ? 'Kosongkan bila satu hari' : undefined}
          disabled={mati}
        />
      ) : null}
      {aktif.has('half_day') && satuHari ? (
        <Card variant="tight" style={s.barisSwitch}>
          <View style={{ flex: 1 }}>
            <Text variant="label">Setengah hari</Text>
            <Text variant="meta">Hanya untuk {meta.label.toLowerCase()} satu hari</Text>
          </View>
          <Switch value={n.half_day} onValueChange={(v) => f.ubah('half_day', v)} label="Setengah hari" disabled={mati} />
        </Card>
      ) : null}

      {aktif.has('date') ? (
        <DateInput
          label={kategori === 'correction' ? 'Tanggal yang dikoreksi' : 'Tanggal'}
          value={n.date}
          onChange={(v) => f.ubah('date', v)}
          min={minKoreksi}
          max={kategori === 'correction' ? hariIni : undefined}
          required
          error={f.galat.date}
          hint={kategori === 'correction' && jenis.max_backdate_days !== null ? `Maksimal ${jenis.max_backdate_days} hari ke belakang.` : undefined}
          disabled={mati}
        />
      ) : null}

      {aktif.has('start_time') ? (
        <View style={s.dua}>
          <View style={{ flex: 1 }}>
            <InputJam label="Jam mulai" judulDialog="Pilih jam mulai" value={n.start_time} onChange={(v) => f.ubah('start_time', v)} error={f.galat.start_time} disabled={mati} />
          </View>
          <View style={{ flex: 1 }}>
            <InputJam label="Jam selesai" judulDialog="Pilih jam selesai" value={n.end_time} onChange={(v) => f.ubah('end_time', v)} error={f.galat.end_time} disabled={mati} />
          </View>
        </View>
      ) : null}

      {aktif.has('check_in') ? (
        <View style={{ gap: 8 }}>
          <View style={s.dua}>
            <View style={{ flex: 1 }}>
              <InputJam label="Jam masuk benar" judulDialog="Jam masuk yang benar" value={n.check_in} onChange={(v) => f.ubah('check_in', v)} error={f.galat.check_in} placeholder="Tidak diubah" clearable disabled={mati} />
            </View>
            <View style={{ flex: 1 }}>
              <InputJam label="Jam pulang benar" judulDialog="Jam pulang yang benar" value={n.check_out} onChange={(v) => f.ubah('check_out', v)} error={f.galat.check_out} placeholder="Tidak diubah" clearable disabled={mati} />
            </View>
          </View>
          <Text variant="meta">Isi salah satu atau keduanya. Lintas tengah malam hanya untuk shift malam.</Text>
        </View>
      ) : null}

      {aktif.has('destination') ? (
        <Field label="Tujuan dinas" error={f.galat.destination}>
          <Input value={n.destination} onChangeText={(v) => f.ubah('destination', v)} placeholder="Mis. Gudang mitra, Cikarang" invalid={!!f.galat.destination} disabled={mati} maxLength={150} accessibilityLabel="Tujuan dinas" />
        </Field>
      ) : null}

      {aktif.has('item_name') ? (
        <Field label="Nama barang" error={f.galat.item_name}>
          <Input value={n.item_name} onChangeText={(v) => f.ubah('item_name', v)} placeholder="Mis. Headset USB" invalid={!!f.galat.item_name} disabled={mati} maxLength={150} accessibilityLabel="Nama barang" />
        </Field>
      ) : null}
      {aktif.has('quantity') ? (
        <View style={s.dua}>
          <View style={{ flex: 1 }}>
            <Field label="Jumlah" error={f.galat.quantity}>
              <Input value={n.quantity} onChangeText={(v) => f.ubah('quantity', v.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" invalid={!!f.galat.quantity} disabled={mati} accessibilityLabel="Jumlah" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Satuan (opsional)" error={f.galat.unit}>
              <Input value={n.unit} onChangeText={(v) => f.ubah('unit', v)} placeholder="unit" disabled={mati} maxLength={30} accessibilityLabel="Satuan" />
            </Field>
          </View>
        </View>
      ) : null}
      {aktif.has('unit_price') ? (
        <Field label="Perkiraan harga satuan (opsional)" error={f.galat.unit_price} hint="Ketik angkanya saja; titik ribuan ditambahkan otomatis.">
          <Input
            value={n.unit_price ? `Rp ${ribuan(n.unit_price)}` : ''}
            onChangeText={(v) => f.ubah('unit_price', v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12))}
            keyboardType="number-pad"
            placeholder="Rp 0"
            invalid={!!f.galat.unit_price}
            disabled={mati}
            accessibilityLabel="Perkiraan harga satuan dalam rupiah"
          />
        </Field>
      ) : null}
      {kategori === 'procurement' ? (
        <Card variant="tight" style={s.total}>
          <Text variant="label" tone="muted">
            Perkiraan total
          </Text>
          <Text variant="h3" weight={800}>
            {totalBarang > 0 ? rupiah(totalBarang) : 'Rp —'}
          </Text>
        </Card>
      ) : null}
      {aktif.has('reference_url') ? (
        <Field label="Tautan referensi (opsional)" error={f.galat.reference_url}>
          <Input
            value={n.reference_url}
            onChangeText={(v) => f.ubah('reference_url', v.trim())}
            placeholder="https://"
            leftIcon="link"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            invalid={!!f.galat.reference_url}
            disabled={mati}
            maxLength={500}
            accessibilityLabel="Tautan referensi"
          />
        </Field>
      ) : null}
      {aktif.has('urgency') ? (
        <Field label="Tingkat kebutuhan" error={f.galat.urgency}>
          <SegmentedTabs
            value={n.urgency}
            options={[
              { value: 'biasa', label: 'Biasa' },
              { value: 'mendesak', label: 'Mendesak' },
            ]}
            onChange={(v) => {
              if (!mati) {
                f.ubah('urgency', v);
              }
            }}
          />
        </Field>
      ) : null}

      {aktif.has('substitute_id') ? (
        <PemilihPengganti
          idTerpilih={n.substitute_id}
          namaTerpilih={n.substitute_name}
          onPilih={(o) => {
            f.ubah('substitute_id', o?.id ?? '');
            f.ubah('substitute_name', o?.name ?? '');
          }}
          error={f.galat.substitute_id}
          disabled={mati}
        />
      ) : null}

      <Field label={labelAlasan(jenis.category)} error={f.galat.reason} hint="Terlihat oleh penyetuju dan HR." counter={`${n.reason.length}/${batas.reason}`}>
        <Input
          value={n.reason}
          onChangeText={(v) => f.ubah('reason', v)}
          multiline
          textAlignVertical="top"
          placeholder="Jelaskan keperluan pengajuan"
          maxLength={batas.reason}
          invalid={!!f.galat.reason}
          disabled={mati}
          accessibilityLabel={labelAlasan(jenis.category)}
        />
      </Field>

      {aktif.has('attachments') ? (
        <KolomLampiran
          daftar={f.lampiran}
          batas={batas}
          wajib={wajibLampiran}
          wajibInfo={
            kategori === 'sick' && jenis.requires_attachment_after_days !== null
              ? jenis.requires_attachment_after_days === 0
                ? 'Surat dokter selalu wajib.'
                : `Wajib surat bila lebih dari ${jenis.requires_attachment_after_days} hari.`
              : null
          }
          hint={kategori === 'business_trip' && f.lampiran.length === 0 ? `Mis. surat tugas · PDF, JPG, atau PNG · maks. ${Math.round(batas.max_kilobytes / 1024)} MB` : undefined}
          error={f.galat.attachments}
          disabled={mati}
          sibuk={f.sibukLampiran}
          requestId={f.requestId}
          onTambah={(b) => void f.tambahLampiran(b)}
          onHapus={(item) => void f.hapusSatuLampiran(item)}
        />
      ) : null}

      {!mati ? <KartuRingkasan jenis={jenis} nilai={n} data={f.pratinjau} memuat={f.memuatPratinjau} staf={f.staf} /> : null}

      <BottomSheet visible={sheetKeluar} onClose={() => setSheetKeluar(false)} title="Keluar dari form?">
        <View style={{ gap: 10 }}>
          <Text variant="body" tone="muted">
            {f.requestId ? 'Perubahan Anda belum disimpan.' : 'Isian Anda belum dikirim.'} Simpan sebagai draf agar bisa dilanjutkan nanti.
          </Text>
          <Button
            title="Simpan draf"
            loading={f.menyimpan}
            onPress={() =>
              void (async () => {
                const ok = await f.simpanDraf();
                if (ok) {
                  keluar();
                } else {
                  setSheetKeluar(false);
                }
              })()
            }
          />
          <Button title="Lanjut mengisi" variant="outline" onPress={() => setSheetKeluar(false)} />
          <Button
            title={f.requestId ? 'Buang perubahan' : 'Buang isian'}
            variant="quiet"
            style={{ backgroundColor: 'transparent' }}
            onPress={() =>
              void (async () => {
                if (!f.requestId) {
                  await f.buangDrafPerangkat();
                }
                keluar();
              })()
            }
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheetTipe} onClose={() => setSheetTipe(false)} title={`Jenis ${meta.label.toLowerCase()}`}>
        {f.pilihanTipe.map((t) => (
          <ListRow
            key={t.id}
            title={t.name}
            subtitle={t.locked ? (t.locked_reason ?? 'Dikunci') : !t.eligible ? (t.ineligible_reason ?? 'Belum berhak') : (t.description ?? undefined)}
            trailing={t.locked ? <Icon name="lock" size={18} color={colors.muted} /> : t.id === jenis.id ? <Icon name="check" size={20} color={colors.primary} /> : undefined}
            onPress={() => {
              f.gantiTipe(t);
              setSheetTipe(false);
            }}
            divider
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}

function tambahHari(ymd: string, hari: number): { y: number; m: number; d: number } {
  const p = tanggal.parseIso(ymd) ?? { y: 2026, m: 1, d: 1 };
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + hari));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  statusSimpan: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  titik: { width: 8, height: 8, borderRadius: 4 },
  kunci: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  barisTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barisSwitch: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dua: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
