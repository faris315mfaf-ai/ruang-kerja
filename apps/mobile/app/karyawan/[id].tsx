/**
 * Profil karyawan baca-saja (mockup 11 › 03–05): identitas, penempatan,
 * bawahan langsung, keamanan akun (Atur kata sandi = desktop, aturan R-06),
 * panel permintaan reset, riwayat perubahan (HR/SA). NIK selalu tersamar dan
 * hanya untuk HR/SA; Direksi/Kadiv tanpa NIK, status sandi, dan riwayat.
 * `GET /admin/karyawan/{id}` (docs/sesi/ponsel-b5b-hr.md §1).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { detailKaryawan, type DetailKaryawan } from '@/api/hr';
import { labelAudit, labelModeKerja, statusKaryawan } from '@/features/hr/format';
import { BarisDefinisi } from '@/features/hr/KaryawanParts';
import { KartuPermintaanReset, useKeputusanReset } from '@/features/hr/ResetSandi';
import { lupakanSimpanan, useMuat } from '@/features/hr/useMuat';
import { useTautanDesktop } from '@/features/hr/useTautanDesktop';
import { labelDariKode } from '@/features/settings/profile';
import { tanggalDariYMD, tanggalJam, tanggalPendek } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, Button, Card, DesktopOnlyBanner, ErrorState, Icon, Loading, LockedBanner, LockedState, Pressable, Screen, SectionHeader, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function ProfilKaryawanLayar(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const ambil = useCallback(() => detailKaryawan(id), [id]);
  const m = useMuat<DetailKaryawan>(id ? `karyawan-detail:${id}` : null, ambil);
  const offline = m.offlineSejak !== null;
  const tautan = useTautanDesktop();
  const { muatUlang } = m;
  const keputusan = useKeputusanReset({
    offline,
    onBerubah: useCallback(() => {
      lupakanSimpanan('karyawan');
      void muatUlang('diam');
    }, [muatUlang]),
  });

  if (m.galat && (m.galat.status === 403 || m.galat.status === 404)) {
    return (
      <Screen header={<SubAppBar title="Profil karyawan" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Halaman tidak ditemukan" reason="Profil ini tidak ada atau di luar cakupan Anda." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = m.data;
  const e = d?.employee;
  const st = e ? statusKaryawan(e.status) : null;

  return (
    <Screen header={<SubAppBar title="Profil karyawan" />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {offline ? <Banner tone="neutral" icon="cloud-off" message="Anda offline. Menampilkan data tersimpan; Setujui dan Tolak butuh koneksi." /> : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat profil…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d && e && st ? (
        <>
          <Card style={{ gap: 14 }}>
            <View style={s.kepala}>
              <Avatar name={e.name} size="lg" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="h3" accessibilityRole="header">
                  {e.name}
                </Text>
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {e.position?.name ?? 'Tanpa jabatan'}
                </Text>
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
              </View>
            </View>
            <View style={s.aksi}>
              <Button title="Email" variant="outline" icon="mail" onPress={() => void Linking.openURL(`mailto:${e.email}`)} style={{ flex: 1 }} accessibilityHint={`Kirim email ke ${e.name}`} />
              {e.phone ? <Button title="Telepon" variant="outline" icon="phone" onPress={() => void Linking.openURL(`tel:${e.phone?.replace(/[^\d+]/g, '') ?? ''}`)} style={{ flex: 1 }} accessibilityHint={`Telepon ${e.name}`} /> : null}
            </View>
          </Card>

          {e.status !== 'active' ? (
            <>
              <Banner
                tone="warn"
                icon="user-x"
                message={`Akun ${e.status === 'resigned' ? 'mengundurkan diri' : 'nonaktif'}${e.deactivated_at ? ` sejak ${tanggalPendek(e.deactivated_at)}` : ''}. Tidak bisa masuk dan tidak dihitung di rekap setelah tanggal itu.`}
              />
              {d.can.manage ? <DesktopOnlyBanner message="Mengaktifkan kembali akun tersedia di desktop." onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.web_path, `Karyawan › ${e.name}`)} /> : null}
            </>
          ) : null}

          {d.password_reset && d.can.decide_password_reset ? (
            <View style={{ gap: 8 }}>
              <SectionHeader title="Meminta reset kata sandi" />
              <KartuPermintaanReset
                item={{ ...d.password_reset, can: { decide: true } }}
                offline={offline}
                sibuk={keputusan.sibukId === d.password_reset.id}
                subjudul={e.position?.name ?? e.email}
                onSetujui={() => d.password_reset && keputusan.setujui(d.password_reset)}
                onTolak={() => d.password_reset && keputusan.tolak(d.password_reset)}
              />
            </View>
          ) : null}

          <SectionHeader title="Profil" />
          <Card style={{ gap: 10 }}>
            <BarisDefinisi label="Email">{e.email}</BarisDefinisi>
            {e.employee_number ? <BarisDefinisi label="Nomor karyawan">{e.employee_number}</BarisDefinisi> : null}
            {e.phone ? <BarisDefinisi label="Telepon">{e.phone}</BarisDefinisi> : null}
            {e.nik_masked !== null ? (
              <BarisDefinisi label="NIK">
                <View style={s.nik} accessible accessibilityLabel={`NIK tersamar, berakhiran ${e.nik_masked.slice(-4)}`}>
                  <Text variant="mono">{e.nik_masked}</Text>
                  <Badge tone="neutral">tersamar</Badge>
                </View>
              </BarisDefinisi>
            ) : null}
            <BarisDefinisi label="Bergabung">{e.joined_at ? tanggalDariYMD(e.joined_at) : '—'}</BarisDefinisi>
            {e.has_password !== null ? (
              <BarisDefinisi label="Kata sandi">{`${e.has_password ? 'Sudah diatur' : 'Belum diatur'}${e.password_change_required ? ' · wajib ganti saat masuk' : ''}`}</BarisDefinisi>
            ) : null}
            <BarisDefinisi label="Terakhir masuk">{e.last_login_at ? tanggalJam(e.last_login_at) : 'Belum pernah'}</BarisDefinisi>
            <BarisDefinisi label="Peran">{labelDariKode(e.roles).join(', ') || '—'}</BarisDefinisi>
          </Card>
          {e.nik_masked === null && d.audit === null ? (
            <Text variant="meta" style={{ fontSize: 14 }}>
              NIK, status kata sandi, dan riwayat perubahan hanya untuk HR & Super Admin.
            </Text>
          ) : null}

          <SectionHeader title="Penempatan" />
          <Card style={{ gap: 10 }}>
            <BarisDefinisi label="Divisi">{`${e.division?.name ?? '—'}${d.employee.division_head ? `\nKepala: ${d.employee.division_head.name}` : ''}`}</BarisDefinisi>
            <BarisDefinisi label="Tim">{`${e.team?.name ?? '—'}${d.employee.team_lead ? `\nKetua: ${d.employee.team_lead.name}` : ''}`}</BarisDefinisi>
            <BarisDefinisi label="Jabatan">{e.position?.name ?? '—'}</BarisDefinisi>
            <BarisDefinisi label="Atasan langsung">
              {e.manager ? (
                <Pressable onPress={() => e.manager && router.push(`/karyawan/${e.manager.id}` as never)} scaleTo={1} accessibilityRole="link" accessibilityLabel={`Atasan langsung ${e.manager.name}, buka profil`} style={s.orang}>
                  <Avatar name={e.manager.name} size="sm" />
                  <Text variant="body" tone="link">
                    {e.manager.name}
                  </Text>
                </Pressable>
              ) : (
                '—'
              )}
            </BarisDefinisi>
            <BarisDefinisi label="Mode kerja">{labelModeKerja(e.work_mode)}</BarisDefinisi>
          </Card>

          <SectionHeader title="Bawahan langsung" />
          <Card variant="flat" style={{ padding: d.direct_reports.length > 0 ? 0 : 16, overflow: 'hidden' }}>
            {d.direct_reports.length === 0 ? (
              <Text variant="body" tone="muted">
                Tidak ada bawahan langsung.
              </Text>
            ) : (
              d.direct_reports.map((b, i) => (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/karyawan/${b.id}` as never)}
                  scaleTo={1}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.name}, ${b.position ?? 'tanpa jabatan'}, ${statusKaryawan(b.status).label}`}
                  style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
                >
                  <Avatar name={b.name} size="md" />
                  <View style={{ flex: 1 }}>
                    <Text variant="title" numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
                      {b.position ?? 'Tanpa jabatan'}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              ))
            )}
          </Card>

          {d.can.view_attendance ? (
            <Button title="Lihat absensi bulan ini" variant="tonal" icon="clipboard-check" onPress={() => router.push(`/absensi-tim/rekap/${e.id}` as never)} />
          ) : null}

          {d.password_rule || d.can.set_password || d.can.manage ? (
            <>
              <SectionHeader title="Keamanan akun" />
              {d.password_rule ? (
                <LockedBanner reason={d.password_rule} />
              ) : (
                <DesktopOnlyBanner
                  message={d.can.set_password ? '“Atur kata sandi”, ubah peran, dan nonaktifkan akun hanya tersedia di desktop.' : 'Ubah data, peran, dan status akun hanya tersedia di desktop.'}
                  onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.web_path, `Karyawan › ${e.name}`)}
                />
              )}
              <Text variant="meta" style={{ fontSize: 14 }}>
                Karyawan yang lupa sandi bisa mengajukan sendiri; HR memutusnya di “Permintaan reset sandi”.
              </Text>
            </>
          ) : null}

          {d.audit !== null ? (
            <>
              <SectionHeader title="Riwayat perubahan" />
              <Card style={{ gap: 12 }}>
                {d.audit.length === 0 ? (
                  <Text variant="body" tone="muted">
                    Belum ada perubahan tercatat.
                  </Text>
                ) : (
                  d.audit.map((a) => (
                    <View key={a.id} style={{ gap: 2 }} accessible>
                      <Text variant="label">{labelAudit(a.action, a.fields)}</Text>
                      <Text variant="meta" style={{ fontSize: 14 }}>
                        {`${a.actor ?? 'Sistem'} · ${tanggalPendek(a.created_at)}`}
                      </Text>
                      {a.reason ? (
                        <Text variant="meta" style={{ fontSize: 14 }}>
                          {`Alasan: ${a.reason}`}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>
              <Text variant="meta" style={{ fontSize: 14 }}>
                Hanya HR & Super Admin yang melihat riwayat.
              </Text>
            </>
          ) : null}
        </>
      ) : null}
      {keputusan.sheet}
    </Screen>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aksi: { flexDirection: 'row', gap: 10 },
  nik: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  orang: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
});
