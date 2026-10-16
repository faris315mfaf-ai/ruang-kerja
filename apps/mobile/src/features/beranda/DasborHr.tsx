/**
 * Dashboard HR (spec 02, `15`/`16`): kartu Catat briefing, pengajuan menunggu
 * HR, ringkasan absensi hari ini (angka + tautan), Hiring, slot pengumuman
 * (spanduk di atas). Ekspor = desktop.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { dasborHr, type DasborHr as DataHr } from '@/api/beranda';
import { KartuBriefingCatat } from '@/features/briefing/KartuBriefingCatat';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { tanggalTanpaTahun } from '@/lib/format';
import { Avatar, Badge, Button, Card, DesktopOnlyBanner, ErrorState, Icon, ListRow, Loading, Panel, Skeleton, Text, errorKindFromStatus } from '@/ui';

import { BarisFilter, PetakKpi, hadirTotal } from './bagianDasbor';
import type { DasborProps } from './DasborDivisi';
import { angka } from './format';
import { bukaAbsensiHr, bukaHiring, bukaPersetujuan } from './nav';
import { PitaGagalSegar, PitaOffline } from './Pita';
import { useMuat } from './useMuat';

export function DasborHr({ kepala, registrasiMuat }: DasborProps): React.JSX.Element {
  const [divisi, setDivisi] = useState<string | null>(null);
  const [tim, setTim] = useState<string | null>(null);
  const ambil = useCallback(() => dasborHr({ divisi, tim }), [divisi, tim]);
  const h = useMuat<DataHr>(ambil);
  const { kirim, mengirim } = useKirimTautan();
  const { muat } = h;

  useEffect(() => {
    registrasiMuat(async () => muat(true));
    return () => registrasiMuat(null);
  }, [registrasiMuat, muat]);

  const d = h.data;
  const kepalaNode = kepala({
    judul: 'Dashboard HR',
    subjudul: d ? `${d.scope.label} · ${d.scope.member_count} karyawan aktif` : undefined,
  });

  if (d === null) {
    return (
      <View style={{ gap: 16 }}>
        {kepalaNode}
        {h.galat !== null && !h.memuat ? (
          <ErrorState
            kind={errorKindFromStatus(h.galat.status)}
            title={h.galat.status === 403 || h.galat.status === 404 ? 'Tidak ada akses' : 'Dashboard gagal dimuat'}
            message={h.galat.status === 403 || h.galat.status === 404 ? h.galat.message : 'Data HR tidak bisa diambil. Periksa koneksi lalu coba lagi.'}
            onRetry={() => void h.muat()}
          />
        ) : (
          <View style={{ gap: 12 }} accessibilityLabel="Memuat dashboard HR…">
            <Skeleton height={150} radiusPx={24} />
            <Skeleton height={180} radiusPx={24} />
            <Loading rows={2} label="Memuat dashboard HR…" />
          </View>
        )}
      </View>
    );
  }

  const a = d.attendance;
  const c = a.counts;
  const hadir = hadirTotal(c);
  const pctHadir = c.scheduled > 0 ? Math.round((hadir / c.scheduled) * 100) : null;
  const catatanAway = [c.leave > 0 ? `${c.leave} cuti` : null, c.sick > 0 ? `${c.sick} sakit` : null, c.permit > 0 ? `${c.permit} izin` : null, c.business_trip > 0 ? `${c.business_trip} dinas` : null]
    .filter((x): x is string => x !== null)
    .join(' · ');

  return (
    <View style={{ gap: 16 }}>
      {kepalaNode}
      {h.offline ? <PitaOffline terakhir={h.terakhir} /> : h.gagalSegar ? <PitaGagalSegar /> : null}

      <BarisFilter filters={d.filters} divisi={divisi} tim={tim} onDivisi={(id) => { setDivisi(id); setTim(null); }} onTim={setTim} />

      {d.briefing ? <KartuBriefingCatat kartu={d.briefing} onDiubah={() => void h.muat(true)} /> : null}

      <Panel
        title="Menunggu HR"
        actionLabel={d.pending.count > 0 ? 'Semua' : undefined}
        onAction={d.pending.count > 0 ? bukaPersetujuan : undefined}
      >
        {d.pending.count === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            Tidak ada pengajuan yang menunggu HR.
          </Text>
        ) : (
          <>
            <Badge tone="warning">{`${d.pending.count} menunggu`}</Badge>
            {d.pending.items.map((p) => (
              <ListRow
                key={p.id}
                leading={<Avatar name={p.user.name} />}
                title={`${p.type.name} · ${p.user.name}`}
                subtitle={`${tanggalTanpaTahun(p.start_at)}${p.days ? ` · ${angka(p.days, 1)} hari` : ''} · menunggu langkah HR`}
                trailing={<Badge tone="warning">HR</Badge>}
                onPress={bukaPersetujuan}
                style={{ paddingHorizontal: 0 }}
              />
            ))}
            <Button title="Semua pengajuan menunggu HR" variant="quiet" size="sm" onPress={bukaPersetujuan} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          </>
        )}
      </Panel>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="h3" accessibilityRole="header">
            Absensi hari ini
          </Text>
          <Badge tone={h.offline ? 'neutral' : 'success'}>{h.offline ? 'Terakhir' : 'Langsung'}</Badge>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PetakKpi label="Hadir" nilai={`${angka(hadir)}/${angka(c.scheduled)}`} catatan={pctHadir !== null ? `${pctHadir}%` : 'belum ada jadwal'} />
          <PetakKpi label="Terlambat" nilai={angka(c.late)} catatan={`dari ${angka(hadir)} hadir`} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PetakKpi label="Belum check-in" nilai={angka(c.not_checked_in)} catatan="jadwal berjalan" />
          <PetakKpi label="Cuti/izin/sakit" nilai={angka(c.leave + c.permit + c.sick + c.business_trip)} catatan={catatanAway || 'tidak ada'} />
        </View>
        <View>
          <ListRow
            icon="eye"
            iconTone="warn"
            title="Perlu ditinjau"
            subtitle={a.review_count > 0 ? `${a.review_count} check-in ditandai mencurigakan` : 'Tidak ada check-in mencurigakan'}
            onPress={bukaAbsensiHr}
            style={{ paddingHorizontal: 0 }}
          />
          <ListRow
            icon="log-out"
            iconTone="bad"
            title="Lupa check-out kemarin"
            subtitle={a.missing_check_out_count > 0 ? `${a.missing_check_out_count} karyawan` : 'Tidak ada'}
            onPress={bukaAbsensiHr}
            divider
            style={{ paddingHorizontal: 0 }}
          />
          <ListRow
            icon="chart-no-axes-column"
            iconTone="teal"
            title="Kedisiplinan & rekap"
            subtitle="Tren 8 minggu, ekspor di desktop"
            onPress={bukaAbsensiHr}
            divider
            style={{ paddingHorizontal: 0 }}
          />
        </View>
        <Button title="Buka Absensi" variant="quiet" size="sm" onPress={bukaAbsensiHr} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Text variant="h3" accessibilityRole="header">
          Hiring
        </Text>
        {d.hiring.tersedia ? (
          <>
            <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
              Lowongan, kandidat, dan keputusan akhir dikelola di modul Hiring.
            </Text>
            <Button title="Buka hiring" variant="tonal" onPress={bukaHiring} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="info" size={18} />
            <Text variant="body" tone="muted" style={{ fontSize: 15, flex: 1 }}>
              Modul rekrutmen belum diaktifkan untuk perusahaan ini.
            </Text>
          </View>
        )}
      </Card>

      <DesktopOnlyBanner message="Ekspor Excel dan PDF serta rekap bulanan tersedia di desktop." onSendLink={mengirim ? undefined : () => void kirim('/absensi/kedisiplinan')} />
    </View>
  );
}
