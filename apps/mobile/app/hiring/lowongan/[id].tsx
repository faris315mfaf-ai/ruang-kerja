/**
 * Pengaturan lowongan (mockup 11 › 11, HR/SA): detail (judul, divisi,
 * deskripsi, status + dialog tutup), tim penilai (pewawancara & penyetuju
 * akhir), pemetaan field Google Form, pertanyaan wawancara, sambungan Google
 * Form (URL saja; pemasangan skrip = desktop, "Kirim tautan ke email saya"),
 * hapus lowongan. Bilah "Simpan perubahan" menempel di bawah (D14).
 * Secret webhook tidak pernah dikirim ke ponsel.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { hapusLowongan, pengaturanLowongan, simpanLowongan, type IsianLowongan, type KunciField, type OrangHiring, type PengaturanLowongan, type StatusLowongan } from '@/api/hiring';
import { galatAwalan, galatField, nadaStatusLowongan, pesanGalat } from '@/features/hiring/format';
import { BannerOffline, BarisOrang, HalamanTidakDitemukan, TombolLepas } from '@/features/hiring/parts';
import { DaftarPertanyaanLowongan } from '@/features/hiring/PertanyaanLowongan';
import { PemilihOrang } from '@/features/hiring/sheets';
import { useHiringData } from '@/features/hiring/useHiringData';
import { useTautanDesktop } from '@/features/hr/useTautanDesktop';
import { fontFamily } from '@/theme';
import { Badge, Banner, BottomSheet, Button, Card, DesktopOnlyBanner, ErrorState, Field, Input, Loading, LockedState, Radio, Screen, SegmentedTabs, SelectField, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

const FIELD: KunciField[] = ['full_name', 'email', 'phone', 'cv_url'];
const LABEL_FIELD: Record<KunciField, string> = { full_name: 'Nama lengkap', email: 'Email', phone: 'No. HP', cv_url: 'CV' };

function isianDari(d: PengaturanLowongan): IsianLowongan {
  const fm = d.position.field_map ?? {};
  return {
    title: d.position.title,
    division_id: d.position.division_id,
    description: d.position.description,
    status: d.position.status,
    interviewer_ids: [...d.position.interviewer_ids],
    final_approver_ids: [...d.position.final_approver_ids],
    field_map: { full_name: fm.full_name ?? null, email: fm.email ?? null, phone: fm.phone ?? null, cv_url: fm.cv_url ?? null },
  };
}

function sama(a: IsianLowongan, b: IsianLowongan): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function PengaturanLowonganLayar(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const tautan = useTautanDesktop();
  const ambil = useCallback(() => pengaturanLowongan(id ?? ''), [id]);
  const m = useHiringData<PengaturanLowongan>(id ? `lowongan:${id}` : null, ambil);
  const d = m.data;
  const offline = m.offlineSejak !== null;

  const [isian, setIsian] = useState<IsianLowongan | null>(null);
  const [asal, setAsal] = useState<IsianLowongan | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);
  const [pemilih, setPemilih] = useState<'interviewer' | 'approver' | null>(null);
  const [sheetDivisi, setSheetDivisi] = useState(false);

  useEffect(() => {
    if (d && (isian === null || (asal !== null && sama(isian, asal)))) {
      const baru = isianDari(d);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- formulir mengikuti server selama belum diubah
      setIsian(baru);
      setAsal(baru);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat data server berubah
  }, [d]);

  const orang = useMemo(() => {
    const peta = new Map<string, OrangHiring>();
    for (const o of d?.employees ?? []) {
      peta.set(o.id, o);
    }
    for (const o of [...(d?.position.interviewers ?? []), ...(d?.position.approvers ?? [])]) {
      peta.set(o.id, { ...peta.get(o.id), ...o });
    }
    return peta;
  }, [d]);

  const kotor = isian !== null && asal !== null && !sama(isian, asal);

  async function kembali(): Promise<void> {
    if (kotor) {
      const ok = await dialog.confirm({ title: 'Buang perubahan?', message: 'Perubahan pengaturan lowongan belum disimpan.', confirmLabel: 'Buang', destructive: true });
      if (!ok) {
        return;
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/hiring?tab=lowongan' as never);
    }
  }

  if (m.galat && m.galat.status === 404) {
    return <HalamanTidakDitemukan judul="Lowongan" alasan="Lowongan ini tidak ada atau tidak bisa Anda lihat." />;
  }
  if (m.galat && m.galat.status === 403) {
    return (
      <Screen header={<SubAppBar title="Lowongan" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState
          title="Pengaturan hanya untuk HR"
          reason="Pewawancara dan penyetuju akhir tidak mengubah lowongan. Lihat kandidat lowongan ini dari tab Kandidat."
          actionLabel="Lihat kandidat"
          onAction={() => router.replace(`/hiring?tab=kandidat&lowongan=${id ?? ''}` as never)}
        />
      </Screen>
    );
  }

  function ubah<K extends keyof IsianLowongan>(kunci: K, nilai: IsianLowongan[K]): void {
    setIsian((lama) => (lama ? { ...lama, [kunci]: nilai } : lama));
    setGalat((lama) => {
      if (Object.keys(lama).length === 0) {
        return lama;
      }
      const baru = { ...lama };
      for (const k of Object.keys(baru)) {
        if (k === kunci || k.startsWith(`${String(kunci)}.`)) {
          delete baru[k];
        }
      }
      return baru;
    });
  }

  async function gantiStatus(status: StatusLowongan): Promise<void> {
    if (!isian || status === isian.status) {
      return;
    }
    if (status === 'closed') {
      const ok = await dialog.confirm({
        title: 'Tutup lowongan ini?',
        message: 'Kiriman Google Form baru akan ditolak. Kandidat yang masih diproses tetap bisa dilanjutkan; data pelamar dihapus 30 hari setelah lowongan ditutup bila belum diputus.',
        confirmLabel: 'Tutup lowongan',
        destructive: true,
      });
      if (!ok) {
        return;
      }
    }
    ubah('status', status);
  }

  async function simpan(): Promise<void> {
    if (!isian || !id || sibuk) {
      return;
    }
    if (isian.title.trim().length < 3) {
      setGalat({ title: 'Judul wajib diisi (minimal 3 karakter).' });
      return;
    }
    setSibuk(true);
    setGalat({});
    const dikirim: IsianLowongan = {
      ...isian,
      title: isian.title.trim(),
      description: isian.description && isian.description.trim() !== '' ? isian.description.trim() : null,
      field_map: Object.fromEntries(FIELD.map((f) => [f, isian.field_map[f] && isian.field_map[f]?.trim() !== '' ? (isian.field_map[f]?.trim() ?? null) : null])) as Record<KunciField, string | null>,
    };
    try {
      const hasil = await simpanLowongan(id, dikirim);
      const dibuang = [...dikirim.interviewer_ids.filter((x) => !hasil.position.interviewer_ids.includes(x)), ...dikirim.final_approver_ids.filter((x) => !hasil.position.final_approver_ids.includes(x))];
      const baru = isianDari(hasil);
      setIsian(baru);
      setAsal(baru);
      m.setData(() => hasil);
      snackbar.show({
        message: dibuang.length > 0 ? `${hasil.message} ${dibuang.length} orang dibuang karena bukan karyawan aktif.` : hasil.message,
        variant: dibuang.length > 0 ? 'warn' : 'ok',
      });
    } catch (err) {
      const g = galatField(err);
      if (Object.keys(g).length > 0) {
        setGalat(g);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Pengaturan lowongan gagal disimpan.'), variant: 'bad' });
      }
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(): Promise<void> {
    if (!d || !id) {
      return;
    }
    const ok = await dialog.confirm({
      title: `Hapus lowongan “${d.position.title}”?`,
      message: 'Pertanyaan dan sambungan Google Form ikut dihapus. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await hapusLowongan(id);
      snackbar.show({ message: 'Lowongan dihapus.', variant: 'ok' });
      setAsal(isian);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/hiring?tab=lowongan' as never);
      }
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Lowongan gagal dihapus.'), variant: 'bad' });
    }
  }

  const bisaUbah = d?.can.update === true;
  const adaGalat = Object.keys(galat).length > 0;
  const divisiTerpilih = d?.divisions.find((v) => v.id === isian?.division_id) ?? null;

  function daftarOrang(ids: string[], jenis: 'interviewer_ids' | 'final_approver_ids'): React.ReactNode {
    if (ids.length === 0) {
      return (
        <Text variant="body" tone="muted" style={{ paddingVertical: 6 }}>
          {jenis === 'interviewer_ids' ? 'Belum ada pewawancara.' : 'Belum ada penyetuju akhir.'}
        </Text>
      );
    }
    return ids.map((oid, i) => {
      const o = orang.get(oid) ?? { id: oid, name: 'Karyawan', avatar: null, position: null };
      return (
        <BarisOrang
          key={oid}
          orang={o}
          divider={i > 0}
          kanan={
            bisaUbah ? (
              <TombolLepas
                nama={o.name}
                onPress={() =>
                  ubah(
                    jenis,
                    ids.filter((x) => x !== oid),
                  )
                }
              />
            ) : undefined
          }
        />
      );
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={<SubAppBar title={d?.position.title ?? 'Lowongan'} onBack={() => void kembali()} />}
        refreshing={m.menyegarkan}
        onRefresh={() => void m.muat('tarik')}
        contentStyle={{ paddingTop: 8 }}
        footer={
          d && bisaUbah ? (
            <>
              <Button title="Batal" variant="outline" onPress={() => asal && setIsian(asal)} disabled={!kotor} style={{ flex: 1 }} />
              <Button
                title="Simpan perubahan"
                onPress={() => void simpan()}
                loading={sibuk}
                loadingTitle="Menyimpan…"
                disabled={!kotor || offline}
                disabledReason={offline ? 'Butuh koneksi' : 'Belum ada perubahan'}
                style={{ flex: 1.4 }}
              />
            </>
          ) : undefined
        }
      >
        {m.offlineSejak !== null ? <BannerOffline sejak={m.offlineSejak} /> : null}
        {m.memuat && !d ? (
          <Loading rows={6} label="Memuat pengaturan lowongan…" />
        ) : m.galat && !d ? (
          <ErrorState
            title="Pengaturan lowongan gagal dimuat"
            message={m.galat.status === 0 ? 'Periksa koneksi, lalu coba lagi.' : m.galat.pesan}
            kind={errorKindFromStatus(m.galat.status)}
            onRetry={() => void m.muat()}
          />
        ) : d && isian ? (
          <>
            {adaGalat ? <Banner tone="bad" message="Perubahan belum disimpan. Periksa isian bertanda merah." /> : null}
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="h3" style={{ flex: 1 }}>
                  Detail lowongan
                </Text>
                <Badge tone={nadaStatusLowongan(d.position.status)} dot>
                  {d.position.status_label}
                </Badge>
              </View>
              <Field label="Judul" required error={galat.title ?? null}>
                <Input value={isian.title} onChangeText={(t) => ubah('title', t)} maxLength={150} invalid={!!galat.title} editable={bisaUbah} accessibilityLabel="Judul lowongan" />
              </Field>
              <Field label="Divisi" error={galat.division_id ?? null}>
                <SelectField value={divisiTerpilih?.name ?? 'Tanpa divisi'} onPress={() => setSheetDivisi(true)} disabled={!bisaUbah} accessibilityLabel={`Divisi: ${divisiTerpilih?.name ?? 'Tanpa divisi'}`} />
              </Field>
              <Field label="Deskripsi" hint="Opsional" error={galat.description ?? null}>
                <Input value={isian.description ?? ''} onChangeText={(t) => ubah('description', t)} multiline textAlignVertical="top" maxLength={5000} editable={bisaUbah} accessibilityLabel="Deskripsi lowongan" />
              </Field>
              <Field label="Status" error={galat.status ?? null} hint={isian.status === 'closed' ? 'Ditutup: kiriman Google Form baru ditolak (410).' : isian.status === 'draft' ? 'Draf sudah menerima kiriman Google Form untuk uji.' : 'Dibuka: pelamar masuk otomatis dari Google Form.'}>
                <SegmentedTabs value={isian.status} options={(d.statuses.length > 0 ? d.statuses : [{ value: 'draft' as const, label: 'Draf' }, { value: 'open' as const, label: 'Dibuka' }, { value: 'closed' as const, label: 'Ditutup' }])} onChange={(v) => void gantiStatus(v)} />
              </Field>
            </Card>

            <Card style={{ gap: 6 }}>
              <Text variant="h3">Tim penilai</Text>
              <Text variant="label" style={{ marginTop: 6 }}>
                Pewawancara (tim luar HR)
              </Text>
              {galatAwalan(galat, 'interviewer_ids') ? (
                <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
                  {galatAwalan(galat, 'interviewer_ids')}
                </Text>
              ) : null}
              {daftarOrang(isian.interviewer_ids, 'interviewer_ids')}
              {bisaUbah ? <Button title="Tambah pewawancara" variant="tonal" icon="user-plus" onPress={() => setPemilih('interviewer')} disabled={isian.interviewer_ids.length >= 30} disabledReason="Maks. 30 pewawancara" /> : null}
              <Text variant="label" style={{ marginTop: 12 }}>
                Penyetuju akhir
              </Text>
              {galatAwalan(galat, 'final_approver_ids') ? (
                <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
                  {galatAwalan(galat, 'final_approver_ids')}
                </Text>
              ) : null}
              {daftarOrang(isian.final_approver_ids, 'final_approver_ids')}
              {bisaUbah ? <Button title="Tambah penyetuju" variant="tonal" icon="user-plus" onPress={() => setPemilih('approver')} disabled={isian.final_approver_ids.length >= 10} disabledReason="Maks. 10 penyetuju" /> : null}
              <Text variant="meta" style={{ fontSize: 14 }}>
                Semua penyetuju harus setuju agar kandidat diterima; satu penolakan menolak kandidat.
              </Text>
            </Card>

            <Card style={{ gap: 10 }}>
              <Text variant="h3">Pemetaan field formulir</Text>
              <Text variant="body" tone="muted">
                Judul pertanyaan Google Form untuk tiap data. Kosong = tebakan bawaan.
              </Text>
              {FIELD.map((f) => {
                const bawaan = d.field_defaults.find((x) => x.field === f);
                return (
                  <Field key={f} label={bawaan?.label ?? LABEL_FIELD[f]} error={galat[`field_map.${f}`] ?? null}>
                    <Input
                      value={isian.field_map[f] ?? ''}
                      onChangeText={(t) => ubah('field_map', { ...isian.field_map, [f]: t })}
                      maxLength={500}
                      placeholder={`Bawaan: “${bawaan?.label ?? LABEL_FIELD[f]}”`}
                      editable={bisaUbah}
                      invalid={!!galat[`field_map.${f}`]}
                      accessibilityLabel={`Judul pertanyaan Form untuk ${bawaan?.label ?? LABEL_FIELD[f]}`}
                    />
                  </Field>
                );
              })}
            </Card>

            <DaftarPertanyaanLowongan
              positionId={d.position.id}
              pertanyaan={d.questions}
              bisaUbah={bisaUbah}
              offline={offline}
              onPertanyaan={(daftar) => m.setData((lama) => (lama ? { ...lama, questions: daftar } : lama))}
            />

            <Card style={{ gap: 10 }}>
              <Text variant="h3">Sambungan Google Form</Text>
              <Text variant="body" tone="muted">
                Pelamar mengisi Google Form; jawaban masuk otomatis lewat Apps Script bertanda tangan HMAC.
              </Text>
              <Text variant="label">URL webhook</Text>
              <Text variant="body" selectable style={{ fontFamily: fontFamily.mono500, fontSize: 14 }} accessibilityHint="Tekan lama untuk menyalin">
                {d.google_form.webhook_url}
              </Text>
              <Button
                title="Bagikan URL"
                variant="outline"
                icon="share-2"
                onPress={() => void Share.share({ message: d.google_form.webhook_url }).catch(() => undefined)}
                accessibilityHint="Membuka lembar bagikan untuk menyalin atau mengirim URL"
              />
              <Text variant="meta" style={{ fontSize: 14 }}>
                {d.google_form.has_submissions ? 'Sudah ada kiriman masuk lewat formulir ini.' : 'Belum ada kiriman dari formulir.'}
              </Text>
              <DesktopOnlyBanner
                message="Memasang skrip di Google Form dan membuat ulang secret lebih mudah di desktop. Kirim tautan ke email saya untuk melanjutkan di komputer."
                onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.google_form.desktop_path, `pengaturan lowongan “${d.position.title}”`)}
              />
            </Card>

            {bisaUbah ? (
              <Card style={{ gap: 8 }}>
                <Text variant="h3">Hapus lowongan</Text>
                <Text variant="body" tone="muted">
                  {d.can.delete ? 'Belum ada kandidat.' : `Hanya bisa bila belum ada kandidat. Lowongan ini punya ${d.position.candidates_count} kandidat; tutup saja lowongannya.`}
                </Text>
                <Button title="Hapus lowongan" variant="danger" icon="trash-2" onPress={() => void hapus()} disabled={!d.can.delete || offline} disabledReason={offline ? 'Butuh koneksi' : 'Lowongan sudah punya kandidat'} />
              </Card>
            ) : null}

            <PemilihOrang
              visible={pemilih !== null}
              judul={pemilih === 'interviewer' ? 'Tambah pewawancara' : 'Tambah penyetuju'}
              karyawan={d.employees}
              terpilih={pemilih === 'interviewer' ? isian.interviewer_ids : isian.final_approver_ids}
              maks={pemilih === 'interviewer' ? 30 : 10}
              onClose={() => setPemilih(null)}
              onSimpan={(ids) => {
                ubah(pemilih === 'interviewer' ? 'interviewer_ids' : 'final_approver_ids', ids);
                setPemilih(null);
              }}
            />
            <BottomSheet visible={sheetDivisi} onClose={() => setSheetDivisi(false)} title="Divisi" scrollable>
              <View>
                <Radio
                  selected={isian.division_id === null}
                  onSelect={() => {
                    ubah('division_id', null);
                    setSheetDivisi(false);
                  }}
                  label="Tanpa divisi"
                />
                {d.divisions.map((v) => (
                  <Radio
                    key={v.id}
                    selected={isian.division_id === v.id}
                    onSelect={() => {
                      ubah('division_id', v.id);
                      setSheetDivisi(false);
                    }}
                    label={v.name}
                  />
                ))}
              </View>
            </BottomSheet>
          </>
        ) : null}
      </Screen>
    </View>
  );
}
