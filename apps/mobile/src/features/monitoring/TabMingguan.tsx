/**
 * Monitoring Direksi · Mingguan (mockup 06 › 36, 39-6; D2): pemilih minggu
 * (Sen–Min), matriks orang × hari sebagai kartu per divisi (angka = tugas
 * dilaporkan, D = draf, ! = belum lapor, – = libur; simbol + warna, bukan
 * warna saja), tugas paling banyak dikerjakan, hambatan minggu ini. Sel
 * terlapor & hambatan membuka sheet detail laporan.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { monitorMingguan, type MonitorMingguan, type StatusSel } from '@/api/manajemen';
import { tanggalLaporan } from '@/features/laporan/format';
import { angka, hariTanggal } from '@/features/proyek/format';
import { bukaTugas } from '@/features/proyek/komponen';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { useTheme } from '@/theme';
import { Avatar, Button, Card, EmptyState, ErrorState, Icon, IconButton, ListRow, Panel, Pressable, Skeleton, Text, errorKindFromStatus } from '@/ui';

import { LaporanSheetId } from './LaporanSheetId';

const LABEL_SEL: Record<StatusSel, string> = { reported: 'sudah lapor', draft: 'draf', missing: 'belum lapor', off: 'tidak terjadwal', future: 'belum terjadi' };

export function TabMingguan({ registrasiMuat }: { registrasiMuat: (fn: (() => Promise<void>) | null) => void }): React.JSX.Element {
  const { colors } = useTheme();
  const [minggu, setMinggu] = useState<string | undefined>(undefined);
  const r = useResource<MonitorMingguan>(`mon-mingguan:${minggu ?? 'kini'}`, useCallback(() => monitorMingguan(minggu), [minggu]));
  const [laporan, setLaporan] = useState<string | null>(null);
  const [buka, setBuka] = useState<Set<string>>(new Set());
  const [penuh, setPenuh] = useState<Set<string>>(new Set());
  const { muat } = r;
  useEffect(() => {
    registrasiMuat(muat);
    return () => registrasiMuat(null);
  }, [registrasiMuat, muat]);

  const d = r.data;
  if (!d) {
    return r.galat ? (
      <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} />
    ) : (
      <View style={{ gap: 12 }} accessibilityLabel="Memuat monitoring mingguan…">
        <Skeleton height={56} radiusPx={20} />
        <Skeleton height={220} radiusPx={24} />
        <Skeleton height={160} radiusPx={24} />
      </View>
    );
  }

  const w = d.weekly;
  const sel = (state: StatusSel, items: number): { teks: string; bg: string; fg: string } => {
    switch (state) {
      case 'reported':
        return { teks: String(items), bg: colors.successSoft, fg: colors.success };
      case 'draft':
        return { teks: 'D', bg: colors.warningSoft, fg: colors.warning };
      case 'missing':
        return { teks: '!', bg: colors.dangerSoft, fg: colors.danger };
      case 'off':
        return { teks: '–', bg: colors.surface2, fg: colors.muted };
      default:
        return { teks: '', bg: 'transparent', fg: colors.muted };
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="monitoring" /> : null}
      <Card variant="tight" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 }}>
        <IconButton icon="chevron-left" label="Minggu sebelumnya" variant="ghost" disabled={!w.week.previous} onPress={() => w.week.previous && setMinggu(w.week.previous)} />
        <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <Text variant="title">{w.week.is_current ? 'Minggu ini' : 'Minggu'}</Text>
          <Text variant="meta">{w.week.label}</Text>
        </View>
        <IconButton icon="chevron-right" label="Minggu berikutnya" variant="ghost" disabled={!w.week.next} onPress={() => w.week.next && setMinggu(w.week.next)} />
      </Card>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {`Angka = jumlah tugas dilaporkan · D draf · ! belum lapor · – libur. ${angka(w.totals.reported)} dari ${angka(w.totals.expected)} hari-lapor terisi · ${angka(w.totals.hours, 1)} jam.`}
      </Text>

      {w.divisions.length === 0 ? (
        <EmptyState icon="calendar-days" title="Belum ada jadwal minggu ini" description="Tidak ada karyawan terjadwal pada minggu ini." />
      ) : (
        w.divisions.map((v) => {
          const k = v.id ?? v.name;
          const terbuka = buka.has(k) || w.divisions.length === 1;
          const pct = v.expected > 0 ? Math.round((v.reported / v.expected) * 100) : null;
          const orang = penuh.has(k) ? v.people : v.people.slice(0, 4);
          return (
            <Card key={k} variant="tight" style={{ gap: 12 }}>
              <Pressable
                scaleTo={1}
                onPress={() => setBuka((s) => { const b = new Set(s); if (b.has(k)) b.delete(k); else b.add(k); return b; })}
                accessibilityRole="button"
                accessibilityState={{ expanded: terbuka }}
                accessibilityLabel={`${v.name}, ${v.people.length} orang, ${pct ?? 0}% hari lapor`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="title">{v.name}</Text>
                  <Text variant="meta">{`${v.people.length} orang · ${pct === null ? '—' : `${pct}%`} hari lapor`}</Text>
                </View>
                <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
              </Pressable>
              {terbuka ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }} importantForAccessibility="no-hide-descendants">
                    <View style={{ flex: 1 }} />
                    {w.days.map((h) => (
                      <Text key={h.date} variant="meta" align="center" style={{ width: 34, fontSize: 12 }} tone={h.is_today ? 'primary' : 'muted'}>
                        {h.label.slice(0, 1)}
                      </Text>
                    ))}
                  </View>
                  {orang.map((p) => (
                    <View key={p.user.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={`${p.user.name}: ${p.reported_days} dari ${p.scheduled_days} hari lapor`}>
                        <Avatar name={p.user.name} size="sm" />
                        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                          {p.user.name.split(' ')[0]}
                        </Text>
                      </View>
                      {p.days.map((hari) => {
                        const s = sel(hari.state, hari.items);
                        const label = `${p.user.name}, ${tanggalLaporan(hari.date)}: ${LABEL_SEL[hari.state]}${hari.state === 'reported' ? `, ${hari.items} tugas` : ''}`;
                        const kotak = (
                          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center', borderWidth: hari.state === 'future' ? 1 : 0, borderColor: colors.border, borderStyle: 'dashed' }}>
                            <Text variant="label" style={{ color: s.fg, fontSize: 13 }}>
                              {s.teks}
                            </Text>
                          </View>
                        );
                        return hari.state === 'reported' && hari.report_id ? (
                          <Pressable key={hari.date} onPress={() => setLaporan(hari.report_id)} accessibilityRole="button" accessibilityLabel={`${label}. Buka laporan.`} hitSlop={6} style={{ width: 34, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                            {kotak}
                          </Pressable>
                        ) : (
                          <View key={hari.date} accessible accessibilityLabel={label} style={{ width: 34, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                            {kotak}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                  {v.people.length > 4 ? (
                    <Button
                      title={penuh.has(k) ? 'Sembunyikan' : `+${v.people.length - 4} orang`}
                      variant="quiet"
                      size="sm"
                      onPress={() => setPenuh((s) => { const b = new Set(s); if (b.has(k)) b.delete(k); else b.add(k); return b; })}
                      style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      <Panel title="Tugas paling banyak dikerjakan">
        {w.top_tasks.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Belum ada tugas yang dilaporkan minggu ini.
          </Text>
        ) : (
          w.top_tasks.map((t, i) => (
            <ListRow
              key={t.task_id}
              title={t.title ?? t.key}
              subtitle={`${t.key} · ${t.people} orang${t.hours !== null ? ` · ${angka(t.hours, 1)} jam` : ''}${t.last_percent !== null ? ` · ${t.last_percent}%` : ''}`}
              trailing={<Text variant="label">{`${t.mentions} laporan`}</Text>}
              onPress={t.title ? () => bukaTugas(t.task_id) : undefined}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>

      <Panel title={`Hambatan minggu ini · ${w.blockers.length}`}>
        {w.blockers.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Tidak ada hambatan yang dilaporkan.
          </Text>
        ) : (
          w.blockers.map((b, i) => (
            <ListRow
              key={`${b.report_id}-${i}`}
              leading={<Avatar name={b.user.name} />}
              title={b.text}
              subtitle={`${b.user.name} · ${hariTanggal(b.date)}`}
              onPress={() => setLaporan(b.report_id)}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>
      <LaporanSheetId id={laporan} onClose={() => setLaporan(null)} />
    </View>
  );
}
