/**
 * Buat pengajuan baru — jenis dari /pengajuan/jenis (kategori), lalu field
 * sederhana sesuai kategori (tanggal/jam/jumlah/teks) + alasan wajib.
 * Lampiran, draf, dan pengganti tetap lewat web.
 */
import { Ionicons } from '@/ui/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { jenisPengajuan, kirimPengajuan } from '@/api/endpoints';
import type { LeaveTypeInfo, RequestTypes } from '@/api/types';
import { Badge, Body, Button, Card, CardTitle, Divider, ErrorState, Field, Input, Label, Loading, Meta, Row, Screen } from '@/components/ui';
import { radius, useTheme } from '@/lib/theme';

type Nilai = Record<string, string>;

const regexTanggal = /^\d{4}-\d{2}-\d{2}$/;
const regexJam = /^([01]\d|2[0-3]):[0-5]\d$/;

function validTanggal(nilai: string): boolean {
  if (!regexTanggal.test(nilai)) {
    return false;
  }
  const bagian = nilai.split('-').map(Number);
  const [y, m, d] = [bagian[0] ?? 0, bagian[1] ?? 0, bagian[2] ?? 0];
  const tanggal = new Date(Date.UTC(y, m - 1, d));
  return tanggal.getUTCFullYear() === y && tanggal.getUTCMonth() === m - 1 && tanggal.getUTCDate() === d;
}

function InputTanggal({
  label,
  nilai,
  ubah,
  galat,
  petunjuk,
}: {
  label: string;
  nilai: string;
  ubah: (v: string) => void;
  galat?: string | null;
  petunjuk?: string;
}): React.JSX.Element {
  return (
    <Field label={label} hint={galat ? null : (petunjuk ?? 'Format YYYY-MM-DD')} error={galat}>
      <Input
        value={nilai}
        onChangeText={ubah}
        placeholder="2026-10-12"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        accessibilityLabel={label}
      />
    </Field>
  );
}

function InputJam({ label, nilai, ubah, galat }: { label: string; nilai: string; ubah: (v: string) => void; galat?: string | null }): React.JSX.Element {
  return (
    <Field label={label} hint={galat ? null : 'Format HH:MM (24 jam)'} error={galat}>
      <Input
        value={nilai}
        onChangeText={ubah}
        placeholder="08:00"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        accessibilityLabel={label}
      />
    </Field>
  );
}

export default function LayarPengajuanBaru(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [jenis, setJenis] = useState<RequestTypes | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  const [kategoriAktif, setKategoriAktif] = useState(0);
  const [terpilih, setTerpilih] = useState<LeaveTypeInfo | null>(null);
  const [nilai, setNilai] = useState<Nilai>({});
  const [setengahHari, setSetengahHari] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatField, setGalatField] = useState<Record<string, string>>({});
  const [mengirim, setMengirim] = useState(false);

  useEffect(() => {
    (async () => {
      setMemuat(true);
      try {
        const hasil = await jenisPengajuan();
        setJenis(hasil);
        setKategoriAktif(0);
      } catch (err) {
        setGalatMuat(err instanceof ApiError ? err.message : 'Tidak dapat memuat jenis pengajuan.');
      } finally {
        setMemuat(false);
      }
    })();
  }, []);

  const kategori = useMemo(() => jenis?.categories ?? [], [jenis]);
  const daftarJenis = kategori[kategoriAktif]?.types ?? [];

  function pilih(tipe: LeaveTypeInfo): void {
    setTerpilih(tipe);
    setNilai({});
    setSetengahHari(false);
    setGalat(null);
    setGalatField({});
  }

  const set = (kunci: string, nilaiBaru: string): void => {
    setNilai((lama) => ({ ...lama, [kunci]: nilaiBaru }));
  };

  /** Validasi sisi klien — pesan sama seperti server. */
  function periksa(): boolean {
    const galatBaru: Record<string, string> = {};
    if (!terpilih) {
      setGalat('Pilih jenis pengajuan terlebih dahulu.');
      return false;
    }

    const wajibTanggal = (kunci: string, nama: string): void => {
      const v = (nilai[kunci] ?? '').trim();
      if (!regexTanggal.test(v) || !validTanggal(v)) {
        galatBaru[kunci] = `${nama} wajib diisi (YYYY-MM-DD).`;
      }
    };

    switch (terpilih.category) {
      case 'overtime':
      case 'correction': {
        wajibTanggal('date', 'Tanggal');
        if (terpilih.category === 'overtime') {
          if (!regexJam.test((nilai.start_time ?? '').trim())) {
            galatBaru.start_time = 'Jam mulai wajib diisi (HH:MM).';
          }
          if (!regexJam.test((nilai.end_time ?? '').trim())) {
            galatBaru.end_time = 'Jam selesai wajib diisi (HH:MM).';
          }
        } else {
          const masuk = (nilai.check_in ?? '').trim();
          const pulang = (nilai.check_out ?? '').trim();
          if (masuk === '' && pulang === '') {
            galatBaru.check_in = 'Isi jam masuk dan/atau jam pulang yang benar.';
          }
          if (masuk !== '' && !regexJam.test(masuk)) {
            galatBaru.check_in = 'Format jam masuk HH:MM.';
          }
          if (pulang !== '' && !regexJam.test(pulang)) {
            galatBaru.check_out = 'Format jam pulang HH:MM.';
          }
        }
        break;
      }
      case 'procurement': {
        if ((nilai.item_name ?? '').trim() === '') {
          galatBaru.item_name = 'Nama barang wajib diisi.';
        }
        const jumlah = Number(nilai.quantity ?? '');
        if (!Number.isInteger(jumlah) || jumlah < 1) {
          galatBaru.quantity = 'Jumlah harus bilangan bulat ≥ 1.';
        }
        break;
      }
      default: {
        // leave, permit, sick, business_trip.
        wajibTanggal('start_date', 'Tanggal mulai');
        const akhir = (nilai.end_date ?? '').trim();
        if (akhir !== '' && !validTanggal(akhir)) {
          galatBaru.end_date = 'Format tanggal selesai YYYY-MM-DD.';
        }
        if (terpilih.category === 'business_trip' && (nilai.destination ?? '').trim() === '') {
          galatBaru.destination = 'Tujuan dinas wajib diisi.';
        }
        break;
      }
    }

    if ((nilai.reason ?? '').trim() === '') {
      galatBaru.reason = 'Alasan wajib diisi.';
    }

    setGalatField(galatBaru);
    return Object.keys(galatBaru).length === 0;
  }

  async function kirim(): Promise<void> {
    if (mengirim || !terpilih || !periksa()) {
      return;
    }
    setMengirim(true);
    setGalat(null);

    const isi: Record<string, unknown> = { type: terpilih.id, reason: nilai.reason?.trim() };
    const kunciKirim: Record<string, string> = {
      start_date: 'start_date',
      end_date: 'end_date',
      date: 'date',
      start_time: 'start_time',
      end_time: 'end_time',
      check_in: 'check_in',
      check_out: 'check_out',
      destination: 'destination',
      item_name: 'item_name',
      unit: 'unit',
      reference_url: 'reference_url',
      urgency: 'urgency',
    };
    for (const [kunci, nama] of Object.entries(kunciKirim)) {
      const v = (nilai[kunci] ?? '').trim();
      if (v !== '') {
        isi[nama] = v;
      }
    }
    const jumlah = Number(nilai.quantity ?? '');
    if (Number.isInteger(jumlah) && jumlah >= 1) {
      isi.quantity = jumlah;
    }
    const harga = Number(nilai.unit_price ?? '');
    if (Number.isInteger(harga) && harga >= 0) {
      isi.unit_price = harga;
    }
    if (setengahHari && terpilih.allow_half_day) {
      isi.half_day = true;
    }

    try {
      await kirimPengajuan(isi);
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.errors).length > 0) {
          const petapeta: Record<string, string> = {};
          for (const [kunci, daftar] of Object.entries(err.errors)) {
            if (kunci !== 'leave_type_id' && daftar && daftar[0]) {
              petapeta[kunci] = daftar[0];
            }
          }
          setGalatField(petapeta);
          setGalat(err.errors.leave_type_id?.[0] ?? null);
        } else {
          setGalat(err.message);
        }
      } else {
        setGalat('Gagal mengirim pengajuan. Coba lagi.');
      }
    } finally {
      setMengirim(false);
    }
  }

  if (memuat) {
    return (
      <View style={[gaya.penuh, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Loading label="Memuat jenis pengajuan…" />
      </View>
    );
  }
  if (galatMuat && !jenis) {
    return (
      <View style={[gaya.penuh, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ErrorState
          message={galatMuat}
          onRetry={() => {
            setGalatMuat(null);
            setMemuat(true);
            void jenisPengajuan()
              .then((hasil) => {
                setJenis(hasil);
                setKategoriAktif(0);
              })
              .catch((err: unknown) => {
                setGalatMuat(err instanceof ApiError ? err.message : 'Tidak dapat memuat jenis pengajuan.');
              })
              .finally(() => setMemuat(false));
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[gaya.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[gaya.judulAtas, { color: colors.text }]}>Pengajuan baru</Text>
      </Pressable>

      <Screen contentStyle={{ paddingBottom: 120 }}>
        {/* Kategori */}
        <View style={gaya.kategoriBaris}>
          {kategori.map((kateg, indeks) => (
            <Pressable
              key={kateg.value}
              onPress={() => {
                setKategoriAktif(indeks);
                setTerpilih(null);
              }}
              accessibilityRole="tab"
              accessibilityLabel={kateg.label}
              accessibilityState={{ selected: kategoriAktif === indeks }}
              style={[
                gaya.kategori,
                {
                  backgroundColor: kategoriAktif === indeks ? colors.primary : colors.surface,
                  borderColor: kategoriAktif === indeks ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: kategoriAktif === indeks ? colors.primaryFg : colors.muted,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {kateg.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Pilih jenis */}
        <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
          {daftarJenis.map((tipe, indeks) => (
            <View key={tipe.id}>
              {indeks > 0 ? <Divider /> : null}
              <Row
                title={tipe.name}
                subtitle={tipe.description ?? undefined}
                onPress={() => pilih(tipe)}
                accessibilityLabel={`Pilih jenis ${tipe.name}`}
                right={
                  terpilih?.id === tipe.id ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.subtle} />
                  )
                }
              />
            </View>
          ))}
          {daftarJenis.length === 0 ? <Meta>Tidak ada jenis yang bisa diajukan untuk kategori ini.</Meta> : null}
        </Card>

        {terpilih ? (
          <Card style={{ gap: 12 }}>
            <View style={gaya.kepala}>
              <CardTitle>{terpilih.name}</CardTitle>
              <Badge tone="neutral">{terpilih.day_unit}</Badge>
            </View>

            {terpilih.category === 'leave' || terpilih.category === 'permit' || terpilih.category === 'sick' || terpilih.category === 'business_trip' ? (
              <>
                <InputTanggal label="Tanggal mulai" nilai={nilai.start_date ?? ''} ubah={(v) => set('start_date', v)} galat={galatField.start_date} />
                <InputTanggal
                  label="Tanggal selesai (opsional)"
                  nilai={nilai.end_date ?? ''}
                  ubah={(v) => set('end_date', v)}
                  galat={galatField.end_date}
                  petunjuk="Kosongkan bila satu hari"
                />
                {terpilih.allow_half_day ? (
                  <Pressable
                    onPress={() => setSetengahHari((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: setengahHari }}
                    accessibilityLabel="Ambil setengah hari"
                    style={gaya.cek}
                  >
                    <Ionicons
                      name={setengahHari ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={setengahHari ? colors.primary : colors.subtle}
                    />
                    <Body muted>Setengah hari (hanya untuk satu hari)</Body>
                  </Pressable>
                ) : null}
                {terpilih.category === 'business_trip' ? (
                  <Field label="Tujuan dinas" error={galatField.destination}>
                    <Input
                      value={nilai.destination ?? ''}
                      onChangeText={(v) => set('destination', v)}
                      placeholder="Kota / klien / kegiatan"
                      maxLength={160}
                      accessibilityLabel="Tujuan dinas"
                    />
                  </Field>
                ) : null}
              </>
            ) : null}

            {terpilih.category === 'overtime' ? (
              <>
                <InputTanggal label="Tanggal" nilai={nilai.date ?? ''} ubah={(v) => set('date', v)} galat={galatField.date} />
                <View style={gaya.dua}>
                  <View style={{ flex: 1 }}>
                    <InputJam label="Jam mulai" nilai={nilai.start_time ?? ''} ubah={(v) => set('start_time', v)} galat={galatField.start_time} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputJam label="Jam selesai" nilai={nilai.end_time ?? ''} ubah={(v) => set('end_time', v)} galat={galatField.end_time} />
                  </View>
                </View>
              </>
            ) : null}

            {terpilih.category === 'correction' ? (
              <>
                <InputTanggal label="Tanggal yang dikoreksi" nilai={nilai.date ?? ''} ubah={(v) => set('date', v)} galat={galatField.date} />
                <View style={gaya.dua}>
                  <View style={{ flex: 1 }}>
                    <InputJam label="Jam masuk benar" nilai={nilai.check_in ?? ''} ubah={(v) => set('check_in', v)} galat={galatField.check_in} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputJam label="Jam pulang benar" nilai={nilai.check_out ?? ''} ubah={(v) => set('check_out', v)} galat={galatField.check_out} />
                  </View>
                </View>
                <Meta>Isi salah satu atau keduanya. Lintas tengah malam hanya untuk shift malam.</Meta>
              </>
            ) : null}

            {terpilih.category === 'procurement' ? (
              <>
                <Field label="Nama barang" error={galatField.item_name}>
                  <Input
                    value={nilai.item_name ?? ''}
                    onChangeText={(v) => set('item_name', v)}
                    placeholder="Nama barang yang dibutuhkan"
                    maxLength={160}
                    accessibilityLabel="Nama barang"
                  />
                </Field>
                <View style={gaya.dua}>
                  <View style={{ flex: 1 }}>
                    <Field label="Jumlah" error={galatField.quantity}>
                      <Input
                        value={nilai.quantity ?? ''}
                        onChangeText={(v) => set('quantity', v.replace(/[^0-9]/g, ''))}
                        placeholder="1"
                        keyboardType="number-pad"
                        accessibilityLabel="Jumlah barang"
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Satuan (opsional)" error={galatField.unit}>
                      <Input
                        value={nilai.unit ?? ''}
                        onChangeText={(v) => set('unit', v)}
                        placeholder="unit / pak / lusin"
                        maxLength={30}
                        accessibilityLabel="Satuan barang"
                      />
                    </Field>
                  </View>
                </View>
                <Field label="Perkiraan harga satuan (opsional)" error={galatField.unit_price} hint="Angka rupiah tanpa titik/koma">
                  <Input
                    value={nilai.unit_price ?? ''}
                    onChangeText={(v) => set('unit_price', v.replace(/[^0-9]/g, ''))}
                    placeholder="150000"
                    keyboardType="number-pad"
                    accessibilityLabel="Perkiraan harga satuan"
                  />
                </Field>
                <Field label="Tautan referensi (opsional)" error={galatField.reference_url}>
                  <Input
                    value={nilai.reference_url ?? ''}
                    onChangeText={(v) => set('reference_url', v)}
                    placeholder="https://…"
                    keyboardType="url"
                    autoCapitalize="none"
                    accessibilityLabel="Tautan referensi"
                  />
                </Field>
                <Field label="Tingkat kebutuhan (opsional)">
                  <View style={gaya.urgensi}>
                    {(['biasa', 'mendesak'] as const).map((pilihan) => (
                      <Pressable
                        key={pilihan}
                        onPress={() => set('urgency', pilihan)}
                        accessibilityRole="radio"
                        accessibilityLabel={`Kebutuhan ${pilihan}`}
                        accessibilityState={{ selected: (nilai.urgency ?? 'biasa') === pilihan }}
                        style={[
                          gaya.kategori,
                          {
                            backgroundColor: (nilai.urgency ?? 'biasa') === pilihan ? colors.primary : colors.surface,
                            borderColor: (nilai.urgency ?? 'biasa') === pilihan ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: (nilai.urgency ?? 'biasa') === pilihan ? colors.primaryFg : colors.muted,
                            fontWeight: '700',
                            fontSize: 13,
                          }}
                        >
                          {pilihan === 'biasa' ? 'Biasa' : 'Mendesak'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
              </>
            ) : null}

            <Field label="Alasan" error={galatField.reason}>
              <Input
                value={nilai.reason ?? ''}
                onChangeText={(v) => set('reason', v)}
                placeholder="Jelaskan keperluan pengajuan"
                multiline
                maxLength={500}
                accessibilityLabel="Alasan pengajuan"
              />
            </Field>

            <Meta>Lampiran dan pengganti dapat ditambahkan lewat RuangKerja web.</Meta>
          </Card>
        ) : (
          <Card>
            <Label>Pilih jenis pengajuan di atas untuk melanjutkan.</Label>
          </Card>
        )}
      </Screen>

      {/* Kirim */}
      <View
        style={[
          gaya.kirimBar,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {galat ? (
          <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }} accessibilityRole="alert">
            {galat}
          </Text>
        ) : null}
        <Button
          title="Kirim pengajuan"
          icon="send-outline"
          onPress={() => void kirim()}
          loading={mengirim}
          disabled={mengirim || !terpilih}
        />
      </View>
    </View>
  );
}

const gaya = StyleSheet.create({
  penuh: { flex: 1 },
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  kategoriBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kategori: {
    minHeight: 44,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kepala: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dua: { flexDirection: 'row', gap: 12 },
  cek: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  urgensi: { flexDirection: 'row', gap: 8 },
  kirimBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
});
