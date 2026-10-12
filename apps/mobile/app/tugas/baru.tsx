/**
 * Buat tugas baru — POST /tugas (judul, deskripsi teks polos, tenggat,
 * prioritas). Bila dibuka dari papan, workspace sudah terpilih lewat
 * parameter `workspace`; dari tab Tugas pengguna memilih dulu.
 * Penanggung jawab belum bisa diisi: kontrak API tidak menyediakan daftar
 * anggota workspace (catat di laporan paritas).
 */
import { Ionicons } from '@/ui/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { buatTugas, daftarWorkspace } from '@/api/endpoints';
import type { WorkspaceGroups } from '@/api/types';
import {
  Button,
  Card,
  CardTitle,
  Divider,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Meta,
  Row,
  Screen,
} from '@/components/ui';
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

export default function LayarTugasBaru(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workspace?: string }>();

  const [grup, setGrup] = useState<WorkspaceGroups | null>(null);
  const [memuatWorkspace, setMemuatWorkspace] = useState(false);
  const [galatWorkspace, setGalatWorkspace] = useState<string | null>(null);

  const [terpilih, setTerpilih] = useState<{ id: string; name: string } | null>(() =>
    typeof params.workspace === 'string' ? { id: params.workspace, name: 'Workspace terpilih' } : null,
  );
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tenggat, setTenggat] = useState('');
  const [prioritas, setPrioritas] = useState(3);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatField, setGalatField] = useState<Record<string, string>>({});
  const [mengirim, setMengirim] = useState(false);

  const perluPilih = typeof params.workspace !== 'string' && terpilih === null;

  const muatWorkspace = useCallback(async (): Promise<void> => {
    setMemuatWorkspace(true);
    setGalatWorkspace(null);
    try {
      setGrup(await daftarWorkspace());
    } catch (err) {
      setGalatWorkspace(err instanceof ApiError ? err.message : 'Tidak dapat memuat workspace.');
    } finally {
      setMemuatWorkspace(false);
    }
  }, []);

  useEffect(() => {
    // Daftar workspace selalu dimuat: untuk pemilih, atau nama workspace pra-terpilih.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan daftar workspace
    void muatWorkspace();
  }, [muatWorkspace]);

  const namaTerpilih = useMemo(() => {
    if (terpilih === null) {
      return null;
    }
    for (const bagian of grup?.groups ?? []) {
      const ketemu = bagian.items.find((ruang) => ruang.id === terpilih.id);
      if (ketemu) {
        return ketemu.name;
      }
    }
    return null;
  }, [grup, terpilih]);

  function periksa(): boolean {
    const galatBaru: Record<string, string> = {};
    if (judul.trim() === '') {
      galatBaru.judul = 'Judul tugas wajib diisi.';
    } else if (judul.trim().length > 255) {
      galatBaru.judul = 'Judul tugas maksimal 255 karakter.';
    }
    if (tenggat.trim() !== '' && !validTanggal(tenggat.trim())) {
      galatBaru.tenggat = 'Tenggat tidak valid (YYYY-MM-DD).';
    }
    setGalatField(galatBaru);
    return Object.keys(galatBaru).length === 0;
  }

  async function kirim(): Promise<void> {
    if (mengirim || terpilih === null || !periksa()) {
      return;
    }
    setMengirim(true);
    setGalat(null);
    try {
      const tugas = await buatTugas({
        workspace_id: terpilih.id,
        title: judul.trim(),
        description: deskripsi.trim() === '' ? null : deskripsi.trim(),
        due_date: tenggat.trim() === '' ? null : tenggat.trim(),
        priority: prioritas,
      });
      router.replace(`/tugas/${tugas.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.errors).length > 0) {
          const petapeta: Record<string, string> = {};
          for (const [kunci, daftar] of Object.entries(err.errors)) {
            if (kunci !== 'workspace_id' && daftar && daftar[0]) {
              petapeta[kunci] = daftar[0];
            }
          }
          setGalatField(petapeta);
          setGalat(err.errors.workspace_id?.[0] ?? err.errors.title?.[0] ?? null);
        } else {
          setGalat(err.message);
        }
      } else {
        setGalat('Gagal membuat tugas. Coba lagi.');
      }
    } finally {
      setMengirim(false);
    }
  }

  const judulAtas = terpilih === null ? 'Tugas baru' : `Tugas baru · ${namaTerpilih ?? terpilih.name}`;

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
        <Text style={[gaya.judulAtas, { color: colors.text }]} numberOfLines={1}>
          {judulAtas}
        </Text>
      </Pressable>

      {perluPilih ? (
        <Screen>
          {memuatWorkspace && !grup ? (
            <Loading label="Memuat workspace…" />
          ) : galatWorkspace && !grup ? (
            <ErrorState message={galatWorkspace} onRetry={() => void muatWorkspace()} />
          ) : (
            (grup?.groups ?? []).map((bagian) => (
              <View key={bagian.jenis} style={gaya.bagian}>
                <Label>{bagian.label}</Label>
                <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
                  {bagian.items.map((ruang, indeks) => (
                    <View key={ruang.id}>
                      {indeks > 0 ? <Divider /> : null}
                      <Row
                        title={ruang.name}
                        subtitle={ruang.arsip ? 'Diarsipkan' : ruang.key}
                        onPress={() => setTerpilih({ id: ruang.id, name: ruang.name })}
                        accessibilityLabel={`Pilih workspace ${ruang.name}`}
                        right={<Ionicons name="chevron-forward" size={18} color={colors.subtle} />}
                      />
                    </View>
                  ))}
                  {bagian.items.length === 0 ? <Meta>Tidak ada workspace pada grup ini.</Meta> : null}
                </Card>
              </View>
            ))
          )}
          <Meta>
            Hanya workspace tempat Anda boleh menyunting tugas yang akan menerima —
            workspace hanya-lihat akan ditolak server.
          </Meta>
        </Screen>
      ) : (
        <Screen contentStyle={{ paddingBottom: 140 }}>
          <Card style={{ gap: 12 }}>
            <CardTitle>{terpilih ? (namaTerpilih ?? terpilih.name) : 'Tugas baru'}</CardTitle>

            <Field label="Judul" error={galatField.judul}>
              <Input
                value={judul}
                onChangeText={setJudul}
                placeholder="Judul tugas"
                maxLength={255}
                accessibilityLabel="Judul tugas"
              />
            </Field>

            <Field label="Deskripsi (opsional)" hint="Teks polos" error={galatField.description}>
              <Input
                value={deskripsi}
                onChangeText={setDeskripsi}
                placeholder="Rincian pekerjaan"
                multiline
                maxLength={20000}
                accessibilityLabel="Deskripsi tugas"
              />
            </Field>

            <Field label="Tenggat (opsional)" hint="Format YYYY-MM-DD" error={galatField.tenggat}>
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
              <View style={gaya.prioritas}>
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
                        gaya.chipPrioritas,
                        {
                          backgroundColor: aktif ? colors.primary : colors.surface,
                          borderColor: aktif ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          gaya.titik,
                          { backgroundColor: aktif ? colors.primaryFg : warnaPrioritas(pilihan.nilai, colors) },
                        ]}
                      />
                      <Text
                        style={[
                          gaya.chipTeks,
                          { color: aktif ? colors.primaryFg : colors.muted },
                        ]}
                      >
                        {pilihan.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Meta>Penanggung jawab dapat diatur lewat RuangKerja web.</Meta>
          </Card>
        </Screen>
      )}

      {!perluPilih ? (
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
            title="Buat tugas"
            icon="add"
            onPress={() => void kirim()}
            loading={mengirim}
            disabled={mengirim || terpilih === null}
          />
        </View>
      ) : null}
    </View>
  );
}

const gaya = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  bagian: { gap: 6 },
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
