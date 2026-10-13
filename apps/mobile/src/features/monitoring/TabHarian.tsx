/**
 * Monitoring Direksi · Harian (mockup 06 › 35, 39; D1): navigasi tanggal
 * (masa depan nonaktif), hitung terjadwal/sudah lapor/draf/belum lapor, per
 * divisi, belum lapor (draf = lencana, isi draf tidak pernah dikirim server),
 * laporan terbaru (tugas + persen, hambatan) → sheet detail laporan. Hari
 * libur/akhir pekan: terjadwal 0.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { monitorHarian, type MonitorHarian } from '@/api/manajemen';
import { DetailLaporanSheet } from '@/features/laporan/DetailLaporanSheet';
import { geserHari, tanggalLaporan } from '@/features/laporan/format';
import type { LaporanTimItem } from '@/api/laporan';
import { PetakAngka } from '@/features/proyek/komponen';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, DateInput, EmptyState, ErrorState, IconButton, ListRow, Panel, Pressable, Progress, Skeleton, Text, errorKindFromStatus } from '@/ui';

export function TabHarian({ registrasiMuat }: { registrasiMuat: (fn: (() => Promise<void>) | null) => void }): React.JSX.Element {
  const { colors } = useTheme();
  const [tanggal, setTanggal] = useState<string | undefined>(undefined);
  const r = useResource<MonitorHarian>(`mon-harian:${tanggal ?? 'kini'}`, useCallback(() => monitorHarian(tanggal), [tanggal]));
  const [buka, setBuka] = useState<LaporanTimItem | null>(null);
  const [semuaBelum, setSemuaBelum] = useState(false);
  const [pilihTgl, setPilihTgl] = useState(false);
  const [drafTgl, setDrafTgl] = useState('');
  const { muat } = r;
  useEffect(() => {
    registrasiMuat(muat);
    return () => registrasiMuat(null);
  }, [registrasiMuat, muat]);

  const d = r.data;
  if (!d) {
    return r.galat ? (
      <ErrorState kind={errorKindFromStatus(r.galat.status)} title={r.galat.status === 403 ? 'Monitoring terkunci' : 'Monitoring gagal dimuat'} message={r.galat.status === 403 ? 'Monitoring kerja hanya untuk Direksi dan Super Admin.' : r.galat.message} onRetry={r.galat.status === 403 ? undefined : () => void r.muat()} />
    ) : (
      <View style={{ gap: 12 }} accessibilityLabel="Memuat monitoring harian…">
        <Skeleton height={56} radiusPx={20} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={96} radiusPx={20} style={{ flex: 1 }} />
          <Skeleton height={96} radiusPx={20} style={{ flex: 1 }} />
        </View>
        <Skeleton height={200} radiusPx={24} />
      </View>
    );
  }

  const h = d.daily;
  const t = h.totals;
  const belum = h.missing;
  const tampilBelum = semuaBelum ? belum : belum.slice(0, 4);

  return (
    <View style={{ gap: 16 }}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="monitoring" /> : null}
      <Card variant="tight" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 }}>
        <IconButton icon="chevron-left" label="Hari sebelumnya" variant="ghost" onPress={() => setTanggal(geserHari(h.date, -1))} />
        <Pressable
          scaleTo={1}
          style={{ flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' }}
          onPress={() => {
            setDrafTgl(h.date);
            setPilihTgl(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${h.is_today ? 'Hari ini, ' : ''}${tanggalLaporan(h.date)}. Pilih tanggal.`}
          accessibilityLiveRegion="polite"
        >
          <Text variant="title">{h.is_today ? 'Hari ini' : tanggalLaporan(h.date).split(',')[0]}</Text>
          <Text variant="meta">{`${tanggalLaporan(h.date)}${r.diperbarui ? ` · per ${jam(r.diperbarui)}` : ''}`}</Text>
        </Pressable>
        <IconButton icon="chevron-right" label="Hari berikutnya" variant="ghost" disabled={h.is_today} onPress={() => setTanggal(geserHari(h.date, 1))} />
      </Card>

      {t.scheduled === 0 ? <Banner tone="neutral" icon="calendar-off" message="Tidak ada karyawan terjadwal pada tanggal ini (akhir pekan atau hari libur)." /> : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PetakAngka label="Terjadwal" nilai={String(t.scheduled)} catatan={`${t.people} karyawan aktif`} />
        <PetakAngka label="Sudah lapor" nilai={String(t.reported)} nada="success" />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PetakAngka label="Draf" nilai={String(t.draft)} nada={t.draft > 0 ? 'warning' : undefined} />
        <PetakAngka label="Belum lapor" nilai={String(t.missing)} nada={t.missing > 0 ? 'danger' : undefined} />
      </View>

      {h.divisions.length > 0 ? (
        <Panel title="Per divisi">
          {h.divisions.map((v) => (
            <View key={v.id ?? v.name} style={{ gap: 6 }} accessible accessibilityLabel={`${v.name}: ${v.reported} dari ${v.scheduled} sudah lapor, ${v.draft} draf, ${v.missing} belum`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                  {v.name}
                </Text>
                <Text variant="meta">{`${v.reported}/${v.scheduled} sudah lapor${v.draft ? ` · ${v.draft} draf` : ''}`}</Text>
              </View>
              <Progress value={v.scheduled > 0 ? (v.reported / v.scheduled) * 100 : 0} />
            </View>
          ))}
        </Panel>
      ) : null}

      <Panel title={`Belum lapor · ${belum.length}`}>
        {belum.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {t.scheduled === 0 ? 'Tidak ada jadwal.' : 'Semua yang terjadwal sudah lapor.'}
          </Text>
        ) : (
          <>
            {tampilBelum.map((o, i) => (
              <ListRow
                key={o.id}
                leading={<Avatar name={o.name} />}
                title={o.name}
                subtitle={o.division ?? 'Tanpa divisi'}
                trailing={o.draft ? <Badge tone="warning">Mulai draf</Badge> : <Badge tone="danger">Belum</Badge>}
                divider={i > 0}
                style={{ paddingHorizontal: 0 }}
              />
            ))}
            {belum.length > 4 ? <Button title={semuaBelum ? 'Sembunyikan' : `Lihat ${belum.length - 4} lainnya`} variant="quiet" size="sm" onPress={() => setSemuaBelum((v) => !v)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}
          </>
        )}
      </Panel>

      <Panel title={`Laporan terbaru · ${h.reports.length} terkirim`}>
        {h.reports.length === 0 ? (
          <EmptyState variant="plain" icon="clipboard-pen" title="Belum ada laporan terkirim" description={h.is_today ? 'Laporan biasanya masuk sore hari (pengingat 16.30).' : 'Tidak ada laporan pada tanggal ini.'} />
        ) : (
          h.reports.map((l) => (
            <Pressable
              key={l.id}
              scaleTo={0.99}
              onPress={() => setBuka(l)}
              accessibilityRole="button"
              accessibilityLabel={`${l.user.name}, ${l.user.division ?? ''}, ${l.summary ?? ''}${l.blockers ? `, hambatan: ${l.blockers}` : ''}`}
              style={{ gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={l.user.name} size="sm" />
                <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                  {l.user.name}
                </Text>
                <Text variant="meta">{`${l.user.division ?? ''}${l.submitted_at ? ` · ${jam(l.submitted_at)}` : ''}`}</Text>
              </View>
              {l.summary ? (
                <Text variant="body" style={{ fontSize: 15 }} numberOfLines={3}>
                  {l.summary}
                </Text>
              ) : null}
              {l.items.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {l.items.slice(0, 4).map((it) => (
                    <Badge key={it.id} tone="neutral">{`${it.key ?? 'Di luar tugas'}${it.percent !== null ? ` ${it.percent}%` : ''}`}</Badge>
                  ))}
                </View>
              ) : null}
              {l.blockers ? (
                <Text variant="meta" tone="warning" numberOfLines={2}>
                  {`Hambatan: ${l.blockers}`}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </Panel>

      <DetailLaporanSheet laporan={buka} onClose={() => setBuka(null)} />
      <BottomSheet visible={pilihTgl} onClose={() => setPilihTgl(false)} title="Pilih tanggal" showClose>
        <View style={{ gap: 16 }}>
          <DateInput label="Tanggal" value={drafTgl} onChange={setDrafTgl} max={d.today} required />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Hari ini" variant="outline" style={{ flex: 1 }} onPress={() => { setTanggal(undefined); setPilihTgl(false); }} />
            <Button title="Tampilkan" style={{ flex: 1.4 }} onPress={() => { if (drafTgl) setTanggal(drafTgl); setPilihTgl(false); }} />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
