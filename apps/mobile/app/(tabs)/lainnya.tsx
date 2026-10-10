/**
 * Lainnya — profil, riwayat absensi bulan ini (ringkas), pengajuan saya
 * (daftar + buat baru), perangkat (cabut), dan keluar.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { absensiRiwayat, cabutPerangkat, daftarPengajuan, daftarPerangkat, saya } from '@/api/endpoints';
import type { AttendanceHistory, DeviceRow, EmployeeRequestRow, UserProfile } from '@/api/types';
import { Badge, Button, Card, CardTitle, Divider, Loading, Meta, Row, Screen } from '@/components/ui';
import { durasiMenit, inisial, jam, tanggalPendek, tanggalTanpaTahun } from '@/lib/format';
import { radius, useTheme } from '@/lib/theme';
import { useSession } from '@/session/SessionProvider';

function LencanaStatusPengajuan({ row }: { row: EmployeeRequestRow }): React.JSX.Element {
  const tone =
    row.status === 'approved'
      ? 'success'
      : row.status === 'rejected'
        ? 'danger'
        : row.status === 'revision_requested'
          ? 'warning'
          : row.status === 'canceled'
            ? 'neutral'
            : 'primary';
  return <Badge tone={tone as 'success' | 'danger' | 'warning' | 'neutral' | 'primary'}>{row.status_label}</Badge>;
}

export default function LayarLainnya(): React.JSX.Element {
  const { colors } = useTheme();
  const { user, keluar, perbaruiProfil } = useSession();

  const [profil, setProfil] = useState<UserProfile | null>(user);
  const [riwayat, setRiwayat] = useState<AttendanceHistory | null>(null);
  const [pengajuan, setPengajuan] = useState<EmployeeRequestRow[]>([]);
  const [perangkat, setPerangkat] = useState<DeviceRow[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);

    const [hasilProfil, hasilRiwayat, hasilPengajuan, hasilPerangkat] = await Promise.allSettled([
      saya(),
      absensiRiwayat(),
      daftarPengajuan(1),
      daftarPerangkat(),
    ]);

    if (hasilProfil.status === 'fulfilled') {
      setProfil(hasilProfil.value);
      perbaruiProfil(hasilProfil.value);
    }
    if (hasilRiwayat.status === 'fulfilled') {
      setRiwayat(hasilRiwayat.value);
    }
    if (hasilPengajuan.status === 'fulfilled') {
      setPengajuan(hasilPengajuan.value.requests);
    }
    if (hasilPerangkat.status === 'fulfilled') {
      setPerangkat(hasilPerangkat.value.devices);
    }

    const gagal = [hasilProfil, hasilRiwayat, hasilPengajuan, hasilPerangkat].find((h) => h.status === 'rejected');
    if (gagal && gagal.status === 'rejected') {
      const err = gagal.reason;
      setGalat(err instanceof ApiError ? err.message : 'Sebagian data gagal dimuat.');
    }
    setMemuat(false);
  }, [perbaruiProfil]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  function konfirmasiCabut(perangkatRow: DeviceRow): void {
    Alert.alert('Cabut perangkat?', `${perangkatRow.name ?? 'Perangkat'} akan dikeluarkan dari akun Anda.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Cabut',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await cabutPerangkat(perangkatRow.id);
            } finally {
              // Bila yang dicabut perangkat ini, 401 berikutnya membersihkan sesi.
              await muat();
            }
          })();
        },
      },
    ]);
  }

  const ringkas = riwayat?.recap;
  const hariDicatat = (riwayat?.recap.days ?? []).filter((hari) => hari.dayId !== null).slice(-14).reverse();

  return (
    <Screen onRefresh={() => void muat()} refreshing={memuat && riwayat !== null}>
      <Text style={[gaya.judul, { color: colors.text }]}>Lainnya</Text>

      {memuat && !riwayat && pengajuan.length === 0 ? (
        <Loading label="Memuat…" />
      ) : (
        <>
          {galat ? (
            <Card>
              <Text style={{ color: colors.danger, fontSize: 13 }}>{galat}</Text>
            </Card>
          ) : null}

          {/* Profil */}
          <Card>
            <View style={gaya.profil}>
              <View style={[gaya.avatar, { backgroundColor: colors.linkSoft }]}>
                <Text style={[gaya.avatarTeks, { color: colors.link }]}>{inisial(profil?.name ?? 'RK')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[gaya.nama, { color: colors.text }]}>{profil?.name ?? '…'}</Text>
                <Meta>{profil?.email ?? ''}</Meta>
                <View style={gaya.profilBaris}>
                  {profil?.jabatan ? <Badge tone="neutral">{profil.jabatan}</Badge> : null}
                  {profil?.divisi ? <Badge tone="neutral">{profil.divisi}</Badge> : null}
                  {profil?.work_mode ? <Badge tone="primary">{profil.work_mode.label}</Badge> : null}
                </View>
              </View>
            </View>
          </Card>

          {/* Workspace (papan · catatan · tugas) */}
          <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
            <Row
              title="Workspace"
              subtitle="Papan, catatan, dan tugas per workspace"
              onPress={() => router.push('/workspace')}
              accessibilityLabel="Buka daftar workspace"
              right={<Ionicons name="chevron-forward" size={18} color={colors.subtle} />}
            />
          </Card>

          {/* Riwayat absensi bulan ini */}
          <Card>
            <View style={gaya.kepala}>
              <CardTitle>Absensi bulan ini</CardTitle>
              {riwayat ? <Meta>{riwayat.period.label}</Meta> : null}
            </View>
            {ringkas ? (
              <>
                <View style={gaya.statistik}>
                  <View style={[gaya.statKotak, { backgroundColor: colors.linkSoft }]}>
                    <Text style={[gaya.angka, { color: colors.link }]}>{ringkas.presentDays}</Text>
                    <Meta>Hadir</Meta>
                  </View>
                  <View style={[gaya.statKotak, { backgroundColor: colors.warningSoft }]}>
                    <Text style={[gaya.angka, { color: colors.warning }]}>{ringkas.lateCount}</Text>
                    <Meta>Terlambat</Meta>
                  </View>
                  <View style={[gaya.statKotak, { backgroundColor: colors.infoSoft }]}>
                    <Text style={[gaya.angka, { color: colors.info }]}>{ringkas.leaveDays + ringkas.permitDays}</Text>
                    <Meta>Cuti/izin</Meta>
                  </View>
                </View>

                {hariDicatat.length > 0 ? (
                  <View style={{ gap: 0 }}>
                    {hariDicatat.map((hari, indeks) => (
                      <View key={hari.date}>
                        {indeks > 0 ? <Divider /> : null}
                        <Row
                          title={`${tanggalTanpaTahun(hari.date)} · ${hari.statusLabel ?? '—'}`}
                          subtitle={`${jam(hari.checkIn?.occurredAt ?? null)} → ${jam(hari.checkOut?.occurredAt ?? null)} · ${durasiMenit(hari.workMinutes || null)}`}
                          right={
                            hari.lateMinutes > 0 ? (
                              <Badge tone="warning">+{durasiMenit(hari.lateMinutes)}</Badge>
                            ) : (
                              <Ionicons name="checkmark" size={16} color={colors.success} />
                            )
                          }
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Meta>Belum ada catatan absensi bulan ini.</Meta>
                )}
              </>
            ) : (
              <Loading label="Memuat rekap…" />
            )}
          </Card>

          {/* Pengajuan */}
          <Card>
            <Pressable
              onPress={() => router.push('/pengajuan/baru')}
              accessibilityRole="button"
              accessibilityLabel="Buat pengajuan baru"
              style={({ pressed }) => [gaya.tombolBaru, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Ajukan pengajuan baru</Text>
            </Pressable>

            <CardTitle>Pengajuan saya</CardTitle>
            {pengajuan.length === 0 ? (
              <Meta>Belum ada pengajuan.</Meta>
            ) : (
              <View style={{ gap: 0 }}>
                {pengajuan.slice(0, 5).map((row, indeks) => (
                  <View key={row.id}>
                    {indeks > 0 ? <Divider /> : null}
                    <Row
                      title={`${row.number} · ${row.type.name}`}
                      subtitle={`${tanggalPendek(row.start_at)} – ${tanggalPendek(row.end_at)}${
                        row.days !== null ? ` · ${row.days} ${row.type.day_unit}` : row.minutes !== null ? ` · ${durasiMenit(row.minutes)}` : ''
                      }`}
                      right={<LencanaStatusPengajuan row={row} />}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Perangkat */}
          <Card>
            <CardTitle>Perangkat saya</CardTitle>
            {perangkat.length === 0 ? (
              <Meta>Belum ada perangkat terdaftar.</Meta>
            ) : (
              <View style={{ gap: 0 }}>
                {perangkat.map((perangkatRow, indeks) => (
                  <View key={perangkatRow.id}>
                    {indeks > 0 ? <Divider /> : null}
                    <Row
                      title={`${perangkatRow.name ?? 'Perangkat'} · ${perangkatRow.platform_label}`}
                      subtitle={`Versi aplikasi ${perangkatRow.app_version ?? '—'} · terakhir aktif ${tanggalPendek(perangkatRow.last_seen_at)}`}
                      right={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {perangkatRow.is_current ? <Badge tone="primary">Perangkat ini</Badge> : null}
                          <Pressable
                            onPress={() => konfirmasiCabut(perangkatRow)}
                            accessibilityRole="button"
                            accessibilityLabel={`Cabut perangkat ${perangkatRow.name ?? ''}`}
                            hitSlop={8}
                            style={gaya.cabut}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          </Pressable>
                        </View>
                      }
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button title="Keluar" variant="danger" icon="log-out-outline" onPress={() => void keluar()} />
          <Meta style={{ textAlign: 'center' }}>RuangKerja ponsel v1.0</Meta>
        </>
      )}
    </Screen>
  );
}

const gaya = StyleSheet.create({
  judul: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  profil: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarTeks: { fontSize: 20, fontWeight: '800' },
  nama: { fontSize: 17, fontWeight: '700' },
  profilBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  kepala: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statistik: { flexDirection: 'row', gap: 8 },
  statKotak: { flex: 1, borderRadius: radius.md, padding: 12, alignItems: 'center', gap: 2 },
  angka: { fontSize: 22, fontWeight: '800' },
  tombolBaru: {
    minHeight: 48,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cabut: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
