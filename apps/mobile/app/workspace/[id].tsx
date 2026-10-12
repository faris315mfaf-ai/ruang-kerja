/**
 * Layar workspace — tiga tab bersegmen: Papan · Catatan · Tugas.
 * Papan memakai pola "kolom per segmen" (chip kolom scroll horizontal,
 * kartu kolom terpilih di bawah) — lebih pas untuk layar sempit daripada
 * papan scroll horizontal. Catatan memuat daftar + buat baru (dialog judul);
 * Tugas = daftar datar dari respons papan.
 */
import { Ionicons } from '@/ui/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { buatCatatan, catatanWorkspace, papanWorkspace } from '@/api/endpoints';
import type { BoardColumn, NoteRow, WorkspaceBoard, WorkspaceNotes } from '@/api/types';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Meta,
  Row,
  Screen,
  Segmented,
} from '@/components/ui';
import { KartuPapan } from '@/components/KartuPapan';
import { waktuRelatif } from '@/lib/format';
import { warnaPalet } from '@/lib/palette';
import { radius, useTheme } from '@/lib/theme';

type Tab = 'papan' | 'catatan' | 'tugas';

export default function LayarWorkspace(): React.JSX.Element {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tab, setTab] = useState<Tab>('papan');

  const [papan, setPapan] = useState<WorkspaceBoard | null>(null);
  const [memuatPapan, setMemuatPapan] = useState(true);
  const [galatPapan, setGalatPapan] = useState<string | null>(null);
  const [kolomAktif, setKolomAktif] = useState<string | null>(null);

  const [catatan, setCatatan] = useState<WorkspaceNotes | null>(null);
  const [memuatCatatan, setMemuatCatatan] = useState(false);
  const [galatCatatan, setGalatCatatan] = useState<string | null>(null);
  const [catatanDimuat, setCatatanDimuat] = useState(false);

  const [dialogBuka, setDialogBuka] = useState(false);
  const [judulBaru, setJudulBaru] = useState('');
  const [galatJudul, setGalatJudul] = useState<string | null>(null);
  const [membuat, setMembuat] = useState(false);

  const muatPapan = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      setGalatPapan('Workspace tidak ditemukan.');
      setMemuatPapan(false);
      return;
    }
    setMemuatPapan(true);
    setGalatPapan(null);
    try {
      const hasil = await papanWorkspace(id);
      setPapan(hasil);
      setKolomAktif((lama) =>
        lama !== null && hasil.columns.some((kolom) => kolom.id === lama)
          ? lama
          : (hasil.columns[0]?.id ?? null),
      );
    } catch (err) {
      setGalatPapan(err instanceof ApiError ? err.message : 'Tidak dapat memuat papan.');
    } finally {
      setMemuatPapan(false);
    }
  }, [id]);

  const muatCatatan = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      return;
    }
    setMemuatCatatan(true);
    setGalatCatatan(null);
    try {
      setCatatan(await catatanWorkspace(id));
    } catch (err) {
      // 404 juga untuk flag fitur catatan yang mati.
      setGalatCatatan(err instanceof ApiError ? err.message : 'Tidak dapat memuat catatan.');
    } finally {
      setMemuatCatatan(false);
      setCatatanDimuat(true);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muatPapan();
  }, [muatPapan]);

  useEffect(() => {
    // Catatan dimuat malas saat tab-nya pertama kali dibuka.
    if (tab === 'catatan' && !catatanDimuat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan malas tab catatan
      void muatCatatan();
    }
  }, [tab, catatanDimuat, muatCatatan]);

  // Segarkan daftar catatan saat kembali dari editor (judul/isi berubah).
  useFocusEffect(
    useCallback(() => {
      if (catatanDimuat) {
        void muatCatatan();
      }
    }, [catatanDimuat, muatCatatan]),
  );

  const kolom = useMemo<BoardColumn | null>(
    () => (papan?.columns ?? []).find((k) => k.id === kolomAktif) ?? null,
    [papan, kolomAktif],
  );

  const semuaTugas = useMemo(
    () =>
      (papan?.columns ?? [])
        .flatMap((k) => k.tasks)
        .slice()
        .sort((a, b) => {
          const tanggalA = a.due_date ?? '9999-12-31';
          const tanggalB = b.due_date ?? '9999-12-31';
          return tanggalA === tanggalB ? a.priority - b.priority : tanggalA < tanggalB ? -1 : 1;
        }),
    [papan],
  );

  const namaKolom = useMemo(() => {
    const peta = new Map<string, string>();
    for (const k of papan?.columns ?? []) {
      peta.set(k.id, k.name);
    }
    return peta;
  }, [papan]);

  async function buat(): Promise<void> {
    if (membuat || typeof id !== 'string') {
      return;
    }
    const judul = judulBaru.trim();
    if (judul === '') {
      setGalatJudul('Judul catatan wajib diisi.');
      return;
    }
    setMembuat(true);
    setGalatJudul(null);
    try {
      const catatanBaru = await buatCatatan(id, judul);
      setDialogBuka(false);
      setJudulBaru('');
      router.push(`/catatan/${catatanBaru.id}`);
    } catch (err) {
      setGalatJudul(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal membuat catatan.');
    } finally {
      setMembuat(false);
    }
  }

  const namaWorkspace = papan?.workspace.name ?? catatan?.workspace.name;

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
        <View style={{ flex: 1 }}>
          <Text style={[gaya.judulAtas, { color: colors.text }]} numberOfLines={1}>
            {namaWorkspace ?? 'Workspace'}
          </Text>
        </View>
      </Pressable>

      <Screen contentStyle={{ paddingTop: 0 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'papan', label: 'Papan' },
            { value: 'catatan', label: 'Catatan' },
            { value: 'tugas', label: 'Tugas' },
          ]}
        />

        {/* ── Tab Papan ── */}
        {tab === 'papan' ? (
          memuatPapan && !papan ? (
            <Loading label="Memuat papan…" />
          ) : galatPapan && !papan ? (
            <ErrorState message={galatPapan} onRetry={() => void muatPapan()} />
          ) : papan ? (
            <>
              <Button
                title="Tugas baru"
                icon="add"
                onPress={() => router.push(`/tugas/baru?workspace=${papan.workspace.id}`)}
                accessibilityHint="Membuka form tugas baru di workspace ini"
              />
              {galatPapan ? <Meta>{galatPapan}</Meta> : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={gaya.kolomBaris}
                accessibilityRole="tablist"
              >
                {papan.columns.map((k) => {
                  const aktif = k.id === kolomAktif;
                  return (
                    <Pressable
                      key={k.id}
                      onPress={() => setKolomAktif(k.id)}
                      accessibilityRole="tab"
                      accessibilityLabel={`Kolom ${k.name}`}
                      accessibilityState={{ selected: aktif }}
                      style={[
                        gaya.kolomChip,
                        {
                          backgroundColor: aktif ? colors.primary : colors.surface,
                          borderColor: aktif ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <View style={[gaya.titikKolom, { backgroundColor: warnaPalet(k.color, dark) }]} />
                      <Text
                        style={[
                          gaya.kolomTeks,
                          { color: aktif ? colors.primaryFg : colors.muted },
                        ]}
                        numberOfLines={1}
                      >
                        {k.name}
                      </Text>
                      <View style={[gaya.kolomJumlah, { backgroundColor: aktif ? colors.primaryHover : colors.surface2 }]}>
                        <Text style={[gaya.kolomJumlahTeks, { color: aktif ? colors.primaryFg : colors.muted }]}>
                          {k.tasks.length}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {kolom ? (
                kolom.tasks.length === 0 ? (
                  <EmptyState
                    icon="square-outline"
                    title="Kolom kosong"
                    description={`Belum ada tugas di kolom ${kolom.name}.`}
                  />
                ) : (
                  <View style={{ gap: 8 }}>
                    {kolom.tasks.map((tugas) => (
                      <KartuPapan
                        key={tugas.id}
                        tugas={tugas}
                        onPress={() => router.push(`/tugas/${tugas.id}`)}
                      />
                    ))}
                  </View>
                )
              ) : null}

              {papan.hidden_closed_count > 0 ? (
                <Meta style={{ textAlign: 'center' }}>
                  {papan.hidden_closed_count} tugas ditutup lebih dari 30 hari tidak ditampilkan.
                </Meta>
              ) : null}
            </>
          ) : null
        ) : null}

        {/* ── Tab Catatan ── */}
        {tab === 'catatan' ? (
          memuatCatatan && !catatan ? (
            <Loading label="Memuat catatan…" />
          ) : galatCatatan && !catatan ? (
            <Card>
              <Meta>{galatCatatan}</Meta>
              <Button title="Coba lagi" variant="secondary" icon="refresh" onPress={() => void muatCatatan()} />
            </Card>
          ) : catatan ? (
            <>
              {catatan.can_create ? (
                <Button
                  title="Catatan baru"
                  icon="add"
                  onPress={() => {
                    setJudulBaru('');
                    setGalatJudul(null);
                    setDialogBuka(true);
                  }}
                />
              ) : (
                <Meta>Anda hanya dapat membaca catatan workspace ini.</Meta>
              )}

              {catatan.notes.length === 0 ? (
                <EmptyState
                  icon="document-text-outline"
                  title="Belum ada catatan"
                  description={catatan.can_create ? 'Ketuk "Catatan baru" untuk memulai.' : undefined}
                />
              ) : (
                <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
                  {catatan.notes.map((baris, indeks) => (
                    <View key={baris.id}>
                      {indeks > 0 ? <Divider /> : null}
                      <BarisCatatan
                        baris={baris}
                        onPress={() => router.push(`/catatan/${baris.id}`)}
                      />
                    </View>
                  ))}
                </Card>
              )}
            </>
          ) : null
        ) : null}

        {/* ── Tab Tugas ── */}
        {tab === 'tugas' ? (
          memuatPapan && !papan ? (
            <Loading label="Memuat tugas…" />
          ) : galatPapan && !papan ? (
            <ErrorState message={galatPapan} onRetry={() => void muatPapan()} />
          ) : semuaTugas.length === 0 ? (
            <EmptyState
              icon="checkbox-outline"
              title="Belum ada tugas"
              description="Tugas terbuka dan yang ditutup 30 hari terakhir tampil di sini."
            />
          ) : (
            <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
              <Meta>{semuaTugas.length} tugas</Meta>
              {semuaTugas.map((tugas) => (
                <Row
                  key={tugas.id}
                  title={tugas.title}
                  subtitle={`${tugas.key} · ${namaKolom.get(tugas.status_id) ?? ''}${
                    tugas.due_date ? ` · tenggat ${tugas.due_date}` : ''
                  }`}
                  onPress={() => router.push(`/tugas/${tugas.id}`)}
                  accessibilityLabel={`Buka tugas ${tugas.title}`}
                  right={
                    <Badge tone={tugas.status_category === 'done' ? 'success' : 'neutral'}>
                      {namaKolom.get(tugas.status_id) ?? ''}
                    </Badge>
                  }
                />
              ))}
            </Card>
          )
        ) : null}
      </Screen>

      {/* Dialog catatan baru */}
      <Modal visible={dialogBuka} transparent animationType="fade" onRequestClose={() => setDialogBuka(false)}>
        <Pressable style={gaya.modalLatar} onPress={() => setDialogBuka(false)} accessibilityLabel="Tutup dialog">
          <Pressable style={[gaya.modalKartu, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
            <Text style={[gaya.modalJudul, { color: colors.text }]}>Catatan baru</Text>
            <Field label="Judul" error={galatJudul} hint={galatJudul ? null : 'Workspace ini'}>
              <Input
                value={judulBaru}
                onChangeText={setJudulBaru}
                placeholder="Judul catatan"
                maxLength={200}
                autoFocus
                accessibilityLabel="Judul catatan"
                onSubmitEditing={() => void buat()}
              />
            </Field>
            <View style={gaya.modalAksi}>
              <View style={{ flex: 1 }}>
                <Button title="Batal" variant="secondary" onPress={() => setDialogBuka(false)} disabled={membuat} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Buat" icon="add" onPress={() => void buat()} loading={membuat} disabled={membuat} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function BarisCatatan({ baris, onPress }: { baris: NoteRow; onPress: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const folder = baris.kind === 'folder';
  const sub = folder
    ? 'Folder'
    : `Diperbarui ${waktuRelatif(baris.updated_at)}${baris.penyunting ? ` · ${baris.penyunting}` : ''}`;

  if (folder) {
    return (
      <Row
        title={baris.title}
        subtitle={sub}
        right={<Ionicons name="folder-outline" size={20} color={colors.subtle} />}
      />
    );
  }
  return (
    <Row
      title={baris.title}
      subtitle={sub}
      onPress={onPress}
      accessibilityLabel={`Buka catatan ${baris.title}`}
      right={<Ionicons name="document-text-outline" size={20} color={colors.subtle} />}
    />
  );
}

const gaya = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  kolomBaris: { gap: 8, paddingVertical: 2 },
  kolomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  titikKolom: { width: 10, height: 10, borderRadius: 5 },
  kolomTeks: { fontSize: 14, fontWeight: '700', maxWidth: 140 },
  kolomJumlah: { borderRadius: 999, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  kolomJumlahTeks: { fontSize: 11, fontWeight: '700' },
  modalLatar: { flex: 1, backgroundColor: 'rgba(7, 11, 20, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalKartu: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  modalJudul: { fontSize: 17, fontWeight: '800' },
  modalAksi: { flexDirection: 'row', gap: 12 },
});
