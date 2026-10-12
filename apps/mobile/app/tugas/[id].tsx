/**
 * Detail tugas — ringkasan, deskripsi, checklist (baca), komentar
 * (paginate "muat sebelumnya" + kirim), sunting inline (judul, deskripsi,
 * tenggat, prioritas — 403 ditolak server dengan pesan), hapus (konfirmasi;
 * hanya pembuat/atasan), dan tombol Selesai/Buka (PATCH status).
 */
import { Ionicons } from '@/ui/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import {
  detailTugas,
  hapusTugas,
  kirimKomentar,
  komentarTugas,
  suntingTugas,
  ubahStatusTugas,
} from '@/api/endpoints';
import type { PageMeta, TaskComment, TaskDetail, TaskUpdateBody } from '@/api/types';
import { Badge, Body, Button, Card, CardTitle, Divider, ErrorState, Field, Input, Loading, Meta, Screen } from '@/components/ui';
import { tanggalDariYMD, waktuRelatif, ymdJakarta } from '@/lib/format';
import { warnaPrioritas } from '@/lib/palette';
import { radius, useTheme } from '@/lib/theme';

const PILIHAN_PRIORITAS: { nilai: number; label: string }[] = [
  { nilai: 0, label: 'Tanpa' },
  { nilai: 1, label: 'Urgent' },
  { nilai: 2, label: 'Tinggi' },
  { nilai: 3, label: 'Sedang' },
  { nilai: 4, label: 'Rendah' },
];

const regexTanggal = /^\d{4}-\d{2}-\d{2}$/;

function validTanggal(nilai: string): boolean {
  if (!regexTanggal.test(nilai)) {
    return false;
  }
  const bagian = nilai.split('-').map(Number);
  const [y, m, d] = [bagian[0] ?? 0, bagian[1] ?? 0, bagian[2] ?? 0];
  const tanggal = new Date(Date.UTC(y, m - 1, d));
  return tanggal.getUTCFullYear() === y && tanggal.getUTCMonth() === m - 1 && tanggal.getUTCDate() === d;
}

function BarisKomentar({ komentar }: { komentar: TaskComment }): React.JSX.Element {
  const { colors } = useTheme();
  if (komentar.deleted || komentar.body_text === null) {
    return (
      <View style={komentarGaya.baris}>
        <View style={[komentarGaya.avatar, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="trash-outline" size={14} color={colors.subtle} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[komentarGaya.nama, { color: colors.subtle }]}>Komentar dihapus</Text>
          <Meta>{waktuRelatif(komentar.created_at)}</Meta>
        </View>
      </View>
    );
  }
  return (
    <View style={komentarGaya.baris}>
      <View style={[komentarGaya.avatar, { backgroundColor: colors.linkSoft }]}>
        <Text style={[komentarGaya.avatarTeks, { color: colors.link }]}>
          {(komentar.author?.name ?? '?').slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={komentarGaya.kepala}>
          <Text style={[komentarGaya.nama, { color: colors.text }]}>{komentar.author?.name ?? 'Tidak dikenal'}</Text>
          <Meta>· {waktuRelatif(komentar.created_at)}</Meta>
          {komentar.edited_at ? <Meta>· disunting</Meta> : null}
        </View>
        <Body muted>{komentar.body_text}</Body>
        {komentar.reactions.length > 0 ? (
          <View style={komentarGaya.reaksi}>
            {komentar.reactions.map((reaksi) => (
              <View key={reaksi.emoji} style={[komentarGaya.chipReaksi, { backgroundColor: colors.surface2 }]}>
                <Text style={{ fontSize: 12 }}>{reaksi.emoji}</Text>
                <Text style={[komentarGaya.chipTeks, { color: colors.muted }]}>{reaksi.count}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function LayarDetailTugas(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tugas, setTugas] = useState<TaskDetail | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [menyibuk, setMenyibuk] = useState(false);

  // Komentar — tampil lama→baru (halaman server terbaru-dibalik).
  const [komentar, setKomentar] = useState<TaskComment[]>([]);
  const [metaKomentar, setMetaKomentar] = useState<PageMeta | null>(null);
  const [halamanKomentar, setHalamanKomentar] = useState(1);
  const [memuatKomentar, setMemuatKomentar] = useState(true);
  const [galatKomentar, setGalatKomentar] = useState<string | null>(null);
  const [memuatLagiKomentar, setMemuatLagiKomentar] = useState(false);
  const [teksKomentar, setTeksKomentar] = useState('');
  const [mengirimKomentar, setMengirimKomentar] = useState(false);

  // Sunting inline.
  const [menyunting, setMenyunting] = useState(false);
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tenggat, setTenggat] = useState('');
  const [prioritas, setPrioritas] = useState(3);
  const [galatField, setGalatField] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      setGalat('Tugas tidak ditemukan.');
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      setTugas(await detailTugas(id));
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat tugas.');
    } finally {
      setMemuat(false);
    }
  }, [id]);

  const muatKomentar = useCallback(
    async (halaman: number, tambah: boolean): Promise<void> => {
      if (typeof id !== 'string') {
        return;
      }
      if (tambah) {
        setMemuatLagiKomentar(true);
      } else {
        setMemuatKomentar(true);
      }
      setGalatKomentar(null);
      try {
        const hasil = await komentarTugas(id, halaman);
        setMetaKomentar(hasil.meta);
        setHalamanKomentar(hasil.meta.current_page);
        // Server: terbaru dulu → balik supaya urut lama→baru. Komentar baru
        // yang masuk sejak halaman 1 menggeser halaman berikutnya, jadi
        // halaman lama bisa memuat komentar yang sudah tampil → dedupe per id.
        const halamanIni = hasil.comments.slice().reverse();
        setKomentar((lama) => {
          if (!tambah) {
            return halamanIni;
          }
          const sudah = new Set(lama.map((k) => k.id));
          return [...halamanIni.filter((k) => !sudah.has(k.id)), ...lama];
        });
      } catch (err) {
        setGalatKomentar(err instanceof ApiError ? err.message : 'Tidak dapat memuat komentar.');
      } finally {
        setMemuatKomentar(false);
        setMemuatLagiKomentar(false);
      }
    },
    [id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data & komentar saat layar dibuka
    void muat();
    void muatKomentar(1, false);
  }, [muat, muatKomentar]);
  async function ubahSelesai(target: boolean): Promise<void> {
    if (menyibuk || typeof id !== 'string') {
      return;
    }
    setMenyibuk(true);
    setGalatAksi(null);
    try {
      await ubahStatusTugas(id, { done: target });
      await muat();
    } catch (err) {
      setGalatAksi(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal memindah tugas.');
    } finally {
      setMenyibuk(false);
    }
  }

  async function kirim(): Promise<void> {
    if (mengirimKomentar || typeof id !== 'string') {
      return;
    }
    const isi = teksKomentar.trim();
    if (isi === '') {
      return;
    }
    setMengirimKomentar(true);
    setGalatKomentar(null);
    try {
      const baru = await kirimKomentar(id, isi);
      setKomentar((lama) => (lama.some((k) => k.id === baru.id) ? lama : [...lama, baru]));
      setTeksKomentar('');
      if (metaKomentar) {
        setMetaKomentar({ ...metaKomentar, total: metaKomentar.total + 1 });
      }
    } catch (err) {
      setGalatKomentar(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal mengirim komentar.');
    } finally {
      setMengirimKomentar(false);
    }
  }

  function mulaiSunting(): void {
    if (tugas === null) {
      return;
    }
    setJudul(tugas.title);
    setDeskripsi(tugas.description_text ?? '');
    setTenggat(tugas.due_date ?? '');
    setPrioritas(tugas.priority.value);
    setGalatField({});
    setGalatAksi(null);
    setMenyunting(true);
  }

  function periksaSuntingan(): boolean {
    const galatBaru: Record<string, string> = {};
    if (judul.trim() === '') {
      galatBaru.judul = 'Judul tugas wajib diisi.';
    }
    if (tenggat.trim() !== '' && !validTanggal(tenggat.trim())) {
      galatBaru.tenggat = 'Tenggat tidak valid (YYYY-MM-DD).';
    }
    setGalatField(galatBaru);
    return Object.keys(galatBaru).length === 0;
  }

  async function simpanSuntingan(): Promise<void> {
    if (menyimpan || typeof id !== 'string' || !periksaSuntingan()) {
      return;
    }
    if (tugas === null) {
      return;
    }
    // Kirim hanya field yang benar-benar berubah: mengirim `description`
    // dari teks polos setiap kali akan meratakan deskripsi berformat dari web.
    const ubahan: TaskUpdateBody = {};
    const judulBaru = judul.trim();
    const deskripsiBaru = deskripsi.trim() === '' ? null : deskripsi.trim();
    const deskripsiLama = (tugas.description_text ?? '').trim() === '' ? null : (tugas.description_text ?? '').trim();
    const tenggatBaru = tenggat.trim() === '' ? null : tenggat.trim();
    if (judulBaru !== tugas.title) {
      ubahan.title = judulBaru;
    }
    if (deskripsiBaru !== deskripsiLama) {
      ubahan.description = deskripsiBaru;
    }
    if (tenggatBaru !== (tugas.due_date ?? null)) {
      ubahan.due_date = tenggatBaru;
    }
    if (prioritas !== tugas.priority.value) {
      ubahan.priority = prioritas;
    }
    if (Object.keys(ubahan).length === 0) {
      setMenyunting(false);
      return;
    }
    setMenyimpan(true);
    setGalatAksi(null);
    try {
      const hasil = await suntingTugas(id, ubahan);
      // Respons PATCH tidak membawa `can`; pertahankan izin sebelumnya.
      setTugas((lama) => ({ ...hasil, can: hasil.can ?? lama?.can }));
      setMenyunting(false);
    } catch (err) {
      // Kontrak tidak membawa izin sunting — 403 dari server ditampilkan.
      setGalatAksi(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan perubahan.');
    } finally {
      setMenyimpan(false);
    }
  }

  function konfirmasiHapus(): void {
    if (typeof id !== 'string') {
      return;
    }
    Alert.alert('Hapus tugas?', 'Tugas akan dihapus dan tidak bisa dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setMenyibuk(true);
            setGalatAksi(null);
            try {
              await hapusTugas(id);
              router.back();
            } catch (err) {
              setGalatAksi(err instanceof ApiError ? err.message : 'Gagal menghapus tugas.');
            } finally {
              setMenyibuk(false);
            }
          })();
        },
      },
    ]);
  }

  const masihKomentarLama = metaKomentar !== null && halamanKomentar < metaKomentar.last_page;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[detail.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[detail.judulAtas, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
          Detail tugas
        </Text>
        {tugas ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {!menyunting && tugas.can?.edit !== false ? (
              <Pressable
                onPress={mulaiSunting}
                accessibilityRole="button"
                accessibilityLabel="Sunting tugas"
                hitSlop={8}
                style={detail.tombolAtas}
              >
                <Ionicons name="create-outline" size={22} color={colors.link} />
              </Pressable>
            ) : null}
            {tugas.can?.delete !== false ? (
            <Pressable
              onPress={konfirmasiHapus}
              accessibilityRole="button"
              accessibilityLabel="Hapus tugas"
              hitSlop={8}
              style={detail.tombolAtas}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      {memuat && !tugas ? (
        <Loading label="Memuat tugas…" />
      ) : galat && !tugas ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : tugas ? (
        <Screen contentStyle={{ paddingBottom: 24 }}>
          <View style={{ gap: 6 }}>
            <View style={detail.lencanaBaris}>
              <Badge tone={tugas.status.is_done ? 'success' : 'primary'}>{tugas.status.name}</Badge>
              <Badge tone={tugas.priority.value === 1 ? 'danger' : 'neutral'}>{tugas.priority.label}</Badge>
              {tugas.source === 'attendance' ? <Badge tone="info">dari absen</Badge> : null}
            </View>
            <Text style={[detail.judul, { color: colors.text }]}>{tugas.title}</Text>
            <Meta>
              {tugas.key} · {tugas.workspace.name}
            </Meta>
          </View>

          {menyunting ? (
            <Card style={{ gap: 12 }}>
              <CardTitle>Sunting tugas</CardTitle>
              <Field label="Judul" error={galatField.judul}>
                <Input value={judul} onChangeText={setJudul} maxLength={255} accessibilityLabel="Judul tugas" />
              </Field>
              <Field label="Deskripsi" hint="Teks polos" error={galatField.description}>
                <Input
                  value={deskripsi}
                  onChangeText={setDeskripsi}
                  multiline
                  maxLength={20000}
                  accessibilityLabel="Deskripsi tugas"
                />
              </Field>
              <Field label="Tenggat" hint="Format YYYY-MM-DD, kosongkan bila tidak ada" error={galatField.tenggat}>
                <Input
                  value={tenggat}
                  onChangeText={setTenggat}
                  placeholder="2026-10-12"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  accessibilityLabel="Tenggat tugas"
                />
              </Field>
              <Field label="Prioritas">
                <View style={detail.prioritas}>
                  {PILIHAN_PRIORITAS.map((pilihan) => {
                    const aktif = pilihan.nilai === prioritas;
                    return (
                      <Pressable
                        key={pilihan.nilai}
                        onPress={() => setPrioritas(pilihan.nilai)}
                        accessibilityRole="radio"
                        accessibilityLabel={`Prioritas ${pilihan.label}`}
                        accessibilityState={{ selected: aktif }}
                        style={[
                          detail.chipPrioritas,
                          {
                            backgroundColor: aktif ? colors.primary : colors.surface,
                            borderColor: aktif ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            detail.titik,
                            { backgroundColor: aktif ? colors.primaryFg : warnaPrioritas(pilihan.nilai, colors) },
                          ]}
                        />
                        <Text style={[detail.chipTeks, { color: aktif ? colors.primaryFg : colors.muted }]}>
                          {pilihan.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
              <View style={detail.aksiForm}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Batal"
                    variant="secondary"
                    onPress={() => setMenyunting(false)}
                    disabled={menyimpan}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Simpan" icon="save-outline" onPress={() => void simpanSuntingan()} loading={menyimpan} disabled={menyimpan} />
                </View>
              </View>
              <Meta>Penanggung jawab dapat diubah lewat RuangKerja web.</Meta>
            </Card>
          ) : (
            <>
              <Card>
                <CardTitle>Ringkasan</CardTitle>
                <Field label="Jatuh tempo">
                  <Body muted>{tanggalDariYMD(tugas.due_date)}</Body>
                </Field>
                {tugas.start_date ? (
                  <Field label="Mulai">
                    <Body muted>{tanggalDariYMD(tugas.start_date)}</Body>
                  </Field>
                ) : null}
                <Field label="Penerima">
                  <Body muted>{tugas.assignees.length > 0 ? tugas.assignees.join(', ') : 'Belum ada'}</Body>
                </Field>
                {tugas.completed_at ? (
                  <Field label="Selesai pada">
                    <Body muted>{tanggalDariYMD(ymdJakarta(tugas.completed_at))}</Body>
                  </Field>
                ) : null}
              </Card>

              {tugas.description_text ? (
                <Card>
                  <CardTitle>Deskripsi</CardTitle>
                  <Body muted>{tugas.description_text}</Body>
                </Card>
              ) : null}
            </>
          )}

          {tugas.checklist ? (
            <Card>
              <CardTitle>Checklist</CardTitle>
              <View style={detail.progresWrap}>
                <View style={[detail.progresLatar, { backgroundColor: colors.surface2 }]}>
                  <View
                    style={[
                      detail.progresIsi,
                      {
                        backgroundColor: colors.primary,
                        width: `${Math.round((tugas.checklist.done / Math.max(tugas.checklist.total, 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Meta>
                  {tugas.checklist.done}/{tugas.checklist.total} selesai (hanya-baca)
                </Meta>
              </View>
              <Meta>Mengubah checklist belum didukung aplikasi.</Meta>
            </Card>
          ) : null}

          {/* Komentar */}
          <Card style={{ paddingVertical: 12 }}>
            <View style={detail.kepalaKomentar}>
              <CardTitle>Komentar</CardTitle>
              {metaKomentar ? <Meta>{metaKomentar.total} komentar</Meta> : null}
            </View>

            {memuatKomentar && komentar.length === 0 ? (
              <Loading label="Memuat komentar…" />
            ) : galatKomentar && komentar.length === 0 ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>{galatKomentar}</Text>
                <Button title="Coba lagi" variant="secondary" icon="refresh" onPress={() => void muatKomentar(1, false)} />
              </View>
            ) : (
              <>
                {masihKomentarLama ? (
                  <Button
                    title={memuatLagiKomentar ? 'Memuat…' : 'Muat sebelumnya'}
                    variant="ghost"
                    icon="chevron-up"
                    disabled={memuatLagiKomentar}
                    loading={memuatLagiKomentar}
                    onPress={() => void muatKomentar(halamanKomentar + 1, true)}
                  />
                ) : null}
                {galatKomentar ? <Meta>{galatKomentar}</Meta> : null}

                {komentar.length === 0 ? (
                  <Meta>Belum ada komentar. Mulai diskusi di bawah.</Meta>
                ) : (
                  <View style={{ gap: 12 }}>
                    {komentar.map((satu) => (
                      <BarisKomentar key={satu.id} komentar={satu} />
                    ))}
                  </View>
                )}
              </>
            )}
          </Card>

          {galatAksi ? (
            <Card>
              <Text style={{ color: colors.danger, fontSize: 14 }} accessibilityRole="alert">
                {galatAksi}
              </Text>
            </Card>
          ) : null}
        </Screen>
      ) : null}

      {tugas ? (
        <View
          style={[
            detail.aksiBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {galatAksi ? (
            <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{galatAksi}</Text>
          ) : null}
          <Divider />
          {/* Kotak kirim komentar */}
          <View style={detail.kirimBaris}>
            <View style={{ flex: 1 }}>
              <Input
                value={teksKomentar}
                onChangeText={setTeksKomentar}
                placeholder="Tulis komentar…"
                multiline
                maxLength={20000}
                accessibilityLabel="Komentar baru"
                style={detail.inputKomentar}
              />
            </View>
            <Pressable
              onPress={() => void kirim()}
              disabled={mengirimKomentar || teksKomentar.trim() === ''}
              accessibilityRole="button"
              accessibilityLabel="Kirim komentar"
              accessibilityState={{ disabled: mengirimKomentar || teksKomentar.trim() === '' }}
              style={({ pressed }) => [
                detail.tombolKirim,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                (mengirimKomentar || teksKomentar.trim() === '') && { opacity: 0.45 },
              ]}
            >
              {mengirimKomentar ? (
                <Ionicons name="hourglass-outline" size={20} color={colors.primaryFg} />
              ) : (
                <Ionicons name="send" size={20} color={colors.primaryFg} />
              )}
            </Pressable>
          </View>
          {tugas.status.is_done ? (
            <Button
              title="Buka kembali tugas"
              variant="secondary"
              icon="refresh"
              loading={menyibuk}
              disabled={menyibuk}
              onPress={() => void ubahSelesai(false)}
            />
          ) : (
            <Button
              title="Tandai selesai"
              icon="checkmark"
              loading={menyibuk}
              disabled={menyibuk}
              onPress={() => void ubahSelesai(true)}
            />
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const komentarGaya = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTeks: { fontSize: 14, fontWeight: '800' },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  nama: { fontSize: 14, fontWeight: '700' },
  reaksi: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  chipReaksi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipTeks: { fontSize: 12, fontWeight: '600' },
});

const detail = StyleSheet.create({
  punggung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  tombolAtas: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 21, fontWeight: '800', lineHeight: 28 },
  lencanaBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  progresWrap: { gap: 6 },
  progresLatar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progresIsi: { height: 8, borderRadius: 4 },
  kepalaKomentar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  prioritas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPrioritas: {
    minHeight: 44,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  titik: { width: 10, height: 10, borderRadius: 5 },
  chipTeks: { fontSize: 13, fontWeight: '700' },
  aksiForm: { flexDirection: 'row', gap: 12 },
  kirimBaris: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  inputKomentar: { minHeight: 48, maxHeight: 120, paddingVertical: 12 },
  tombolKirim: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // In normal flow (not absolute) so KeyboardAvoidingView lifts it above the keyboard.
  aksiBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
});
