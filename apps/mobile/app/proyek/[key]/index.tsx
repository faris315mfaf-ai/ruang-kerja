/**
 * Detail proyek (mockup 06 › 05–07, 10, 14–15; `GET /proyek/{key}`): kepala
 * (kesehatan PIC + penanda sistem, sponsor/PIC/target/mulai), tab (Ringkasan ·
 * Tugas · Milestone · Update · File), KPI aktual vs rencana, bilah status
 * tugas, "Dari mana angka ini?", update terbaru + keputusan, arahan Direksi,
 * milestone, burn-up, risiko terbuka, tugas terlambat, tim & beban. Bilah
 * bawah: Direksi "Minta update · Beri arahan", PIC "Update proyek", lainnya
 * tanpa bilah. Mode lihat saja / diarsipkan / offline menonaktifkan tulis.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAksiDireksi } from '@/features/proyek/AksiDireksi';
import { angka, hariTanggal, LABEL_LEVEL, LABEL_MILESTONE, LABEL_STATUS_PROYEK, nadaLevel, nadaMilestone, persen, poin, tglBulan, tglLengkap } from '@/features/proyek/format';
import { BilahStatus, bukaTugas, CincinProgres, GrafikBurnUp, LencanaKesehatan, nadaCincin, PenandaProyek, PetakAngka } from '@/features/proyek/komponen';
import { KartuUpdate } from '@/features/proyek/KartuUpdate';
import { RumusSheet } from '@/features/proyek/RumusSheet';
import { useProyek } from '@/features/proyek/useProyek';
import { useTarik } from '@/features/proyek/useTarik';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { PitaOffline, UbinWorkspace } from '@/features/workspace/bagian';
import { useTheme } from '@/theme';
import {
  Avatar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  DesktopOnlyBanner,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  Panel,
  Progress,
  Screen,
  SheetAction,
  Skeleton,
  SubAppBar,
  TabNav,
  Text,
  errorKindFromStatus,
} from '@/ui';

type Tab = 'ringkasan' | 'tugas' | 'milestone' | 'update' | 'file';

export default function LayarDetailProyek(): React.JSX.Element {
  const { colors } = useTheme();
  const { key: param } = useLocalSearchParams<{ key: string }>();
  const key = typeof param === 'string' ? param : '';
  const r = useProyek(key);
  const { menarik, tarik } = useTarik(r.muat);
  const aksi = useAksiDireksi(() => void r.muat());
  const { kirim, mengirim } = useKirimTautan();
  const [rumus, setRumus] = useState(false);
  const [menu, setMenu] = useState(false);
  const d = r.data;
  const p = d?.project;
  const keyProyek = p?.key ?? key.toUpperCase();
  const k = `/proyek/${encodeURIComponent(keyProyek)}`;

  if (!d || !p) {
    return (
      <Screen header={<SubAppBar title={key.toUpperCase() || 'Proyek'} />}>
        {r.galat ? (
          <ErrorState
            kind={errorKindFromStatus(r.galat.status)}
            title={r.galat.status === 404 ? 'Proyek tidak ditemukan' : r.galat.status === 403 ? 'Tidak ada akses' : 'Proyek gagal dimuat'}
            message={r.galat.status === 404 ? 'Proyek ini tidak ada atau Anda tidak punya akses untuk melihatnya.' : r.galat.message}
            onRetry={r.galat.status === 404 ? undefined : () => void r.muat()}
          />
        ) : (
          <View style={{ gap: 12 }} accessibilityLabel="Memuat proyek…">
            <Skeleton height={64} radiusPx={20} />
            <Skeleton height={44} radiusPx={14} />
            <Skeleton height={200} radiusPx={24} />
            <Skeleton height={160} radiusPx={24} />
          </View>
        )}
      </Screen>
    );
  }

  const m = p.metrics;
  const can = d.can;
  const offline = r.offline;
  const tulisAlasan = offline ? 'Butuh koneksi' : undefined;
  const terbaru = d.updates[0] ?? null;
  const risikoTerbuka = d.risks.filter((x) => x.status === 'open');
  const direksi = can.request_update || can.give_direction;
  const pindahTab = (t: Tab): void => {
    if (t === 'tugas') router.push(`/workspace/${encodeURIComponent(keyProyek)}?tab=tugas` as never);
    else if (t === 'file') router.push(`/workspace/${encodeURIComponent(keyProyek)}?tab=file` as never);
    else if (t === 'milestone') router.push(`${k}/milestone` as never);
    else if (t === 'update') router.push(`${k}/riwayat` as never);
  };
  const jumlahTugas = Object.values(d.status_counts).reduce((a, b) => a + b, 0) - (d.status_counts.canceled ?? 0);

  const footer =
    direksi && !can.archived ? (
      <>
        {can.request_update ? (
          <Button title="Minta update" variant="outline" icon="bell-ring" disabled={offline} disabledReason={tulisAlasan} style={{ flex: 1 }} onPress={() => aksi.mintaUpdate({ key: keyProyek, nama: p.name, pic: p.lead?.name ?? null })} />
        ) : null}
        {can.give_direction ? (
          <Button title="Beri arahan" icon="message-circle" disabled={offline} disabledReason={tulisAlasan} style={{ flex: 1.4 }} onPress={() => aksi.beriArahan({ key: keyProyek, nama: p.name, pic: p.lead?.name ?? null })} />
        ) : null}
      </>
    ) : can.post_update ? (
      <Button title="Update proyek" icon="pen-line" disabled={offline} disabledReason={tulisAlasan} style={{ flex: 1 }} onPress={() => router.push(`${k}/update` as never)} />
    ) : undefined;

  return (
    <Screen
      header={<SubAppBar title={`${p.key} · Proyek`} actions={[{ icon: 'ellipsis-vertical', label: 'Menu proyek', onPress: () => setMenu(true) }]} />}
      refreshing={menarik}
      onRefresh={tarik}
      footer={footer}
    >
      {offline ? <PitaOffline diperbarui={r.diperbarui} objek="proyek" /> : null}
      {can.archived ? <Banner tone="neutral" icon="archive" message="Proyek ini diarsipkan dan hanya bisa dibaca." /> : null}
      {can.view_only && !can.archived ? (
        <Banner
          tone="warn"
          icon="eye"
          title="Mode lihat saja"
          message={direksi ? 'Anda bukan anggota workspace ini. Tugas & komentar tidak bisa diubah; Minta update dan Beri arahan tetap tersedia.' : 'Anda bukan anggota workspace ini, jadi data proyek hanya bisa dibaca.'}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <UbinWorkspace nama={p.name} warna={p.color} tipe="project" ukuran={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2" accessibilityRole="header">
            {p.name}
          </Text>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {[p.division, d.project.member_divisions.length > 1 ? `${d.project.member_divisions.length} divisi terlibat` : null].filter(Boolean).join(' · ') || 'Proyek'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <LencanaKesehatan health={p.health} />
        {p.project_status && p.project_status !== 'active' ? <Badge tone={p.project_status === 'completed' ? 'success' : 'neutral'}>{LABEL_STATUS_PROYEK[p.project_status]}</Badge> : null}
        <PenandaProyek metrics={m} />
        {p.last_update_at ? <Text variant="meta">{`Status dari PIC · ${hariTanggal(p.last_update_at.slice(0, 10))}`}</Text> : null}
      </View>

      <Card variant="tight" style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Orang label="Sponsor" nama={p.sponsor?.name ?? null} />
          <Orang label="PIC" nama={p.lead?.name ?? null} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Nilai label="Target" nilai={p.target_date ? `${tglBulan(p.target_date)}${m.days_left !== null ? ` · ${m.days_left >= 0 ? `${m.days_left} hari lagi` : `lewat ${-m.days_left} hari`}` : ''}` : '—'} />
          <Nilai label="Mulai" nilai={tglLengkap(p.start_date)} />
        </View>
      </Card>

      <TabNav<Tab>
        value="ringkasan"
        onChange={pindahTab}
        options={[
          { value: 'ringkasan', label: 'Ringkasan' },
          { value: 'tugas', label: 'Tugas', badge: jumlahTugas },
          { value: 'milestone', label: 'Milestone', badge: d.milestones.length },
          { value: 'update', label: 'Update', badge: d.updates_total },
          { value: 'file', label: 'File' },
        ]}
      />

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <CincinProgres nilai={m.actual} rencana={m.planned} ukuran={96} tebal={10} nada={nadaCincin(m, p.health)} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label" tone="muted">
              Progres aktual
            </Text>
            <Text variant="kpi">{persen(m.actual)}</Text>
            <Text variant="meta" tone={m.variance !== null && m.variance <= -15 ? 'danger' : 'muted'} style={{ fontSize: 14 }}>
              {`Rencana ${persen(m.planned)} · ${poin(m.variance)} dari rencana`}
            </Text>
          </View>
        </View>
        <Progress value={m.actual ?? 0} marker={m.planned ?? undefined} label={`Progres aktual ${persen(m.actual)}, rencana ${persen(m.planned)}`} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PetakAngka label="Tugas selesai" nilai={`${angka(m.done)}/${angka(m.scope)}`} />
          <PetakAngka label="Terlambat" nilai={angka(m.overdue)} nada={m.overdue > 0 ? 'danger' : undefined} />
          <PetakAngka label="Menuju target" nilai={m.days_left !== null ? `${Math.max(0, m.days_left)} hari` : '—'} />
        </View>
        <BilahStatus jumlah={d.status_counts} />
        <Button title="Dari mana angka ini?" variant="quiet" size="sm" icon="info" onPress={() => setRumus(true)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      </Card>

      {p.next_milestone ? (
        <Card variant="tight" onPress={() => router.push(`${k}/milestone/${p.next_milestone?.id ?? ''}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel={`Milestone berikutnya ${p.next_milestone.name}, ${hariTanggal(p.next_milestone.target_date)}`}>
          <Icon name="flag" size={22} color={p.next_milestone.status === 'missed' ? colors.danger : colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="meta">Milestone berikutnya</Text>
            <Text variant="title" numberOfLines={2}>
              {p.next_milestone.name}
            </Text>
          </View>
          <Text variant="label">{hariTanggal(p.next_milestone.target_date)}</Text>
        </Card>
      ) : null}

      <Panel title="Update terbaru PIC" actionLabel={d.updates_total > 0 ? `Riwayat (${d.updates_total})` : undefined} onAction={() => router.push(`${k}/riwayat` as never)}>
        {terbaru ? (
          <KartuUpdate
            u={terbaru}
            ringkas
            bolehTandai={can.resolve_decision && !offline}
            onTandai={terbaru.decision_needed ? () => void aksi.tandaiSelesai({ key: keyProyek, updateId: terbaru.id, keputusan: terbaru.decision_needed ?? '' }) : undefined}
            onBalas={can.give_direction && !offline && !can.archived ? () => aksi.beriArahan({ key: keyProyek, nama: p.name, pic: p.lead?.name ?? null, updateId: terbaru.id, kutipan: terbaru.blockers ?? terbaru.summary }) : undefined}
          />
        ) : (
          <EmptyState
            variant="plain"
            icon="file-pen-line"
            title="Belum ada update"
            description={can.post_update ? 'Tulis update pertama: status kesehatan, ringkasan, dan hambatan.' : 'PIC belum menulis update untuk proyek ini.'}
            actionLabel={can.post_update && !offline ? 'Tulis update' : undefined}
            onAction={() => router.push(`${k}/update` as never)}
          />
        )}
        {terbaru && can.post_update && !offline ? <Button title="Tulis update" variant="tonal" icon="pen-line" onPress={() => router.push(`${k}/update` as never)} /> : null}
      </Panel>

      {d.directions.length > 0 ? (
        <Panel title="Arahan Direksi">
          {d.directions.slice(0, 3).map((a, i) => (
            <ListRow key={a.id} leading={<Avatar name={a.author?.name ?? 'Direksi'} />} title={a.author?.name ?? 'Direksi'} subtitle={a.body} divider={i > 0} style={{ paddingHorizontal: 0 }} />
          ))}
        </Panel>
      ) : null}

      <Panel title="Milestone" actionLabel={can.manage_milestones && !offline ? 'Tambah' : d.milestones.length > 0 ? 'Semua' : undefined} onAction={() => router.push((can.manage_milestones && !offline ? `${k}/milestone/form` : `${k}/milestone`) as never)}>
        {d.milestones.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {can.manage_milestones ? 'Belum ada milestone. Tambahkan titik penting proyek.' : 'Belum ada milestone.'}
          </Text>
        ) : (
          d.milestones.slice(0, 6).map((ms, i) => (
            <ListRow
              key={ms.id}
              title={ms.name}
              subtitle={`${LABEL_MILESTONE[ms.status]}${ms.tasks.length ? ` · ${ms.tasks.map((t) => t.code).slice(0, 3).join(' ')}` : ''}`}
              trailing={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="label">{tglBulan(ms.target_date)}</Text>
                  <Badge tone={nadaMilestone(ms.status)} dot>
                    {LABEL_MILESTONE[ms.status]}
                  </Badge>
                </View>
              }
              onPress={() => router.push(`${k}/milestone/${ms.id}` as never)}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>

      <Panel title="Burn-up mingguan">
        <GrafikBurnUp titik={d.burnup.points} mulai={d.burnup.start_date} target={d.burnup.target_date} hariIni={d.burnup.today} milestones={d.burnup.milestones} />
        {d.burnup.recent_pace !== null || d.burnup.required_pace !== null ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            {`Laju 4 minggu ${angka(d.burnup.recent_pace, 1)} tugas/minggu · dibutuhkan ${angka(d.burnup.required_pace, 1)} tugas/minggu`}
          </Text>
        ) : null}
      </Panel>

      <Panel title={`Risiko terbuka · ${risikoTerbuka.length}`} actionLabel="Semua" onAction={() => router.push(`${k}/risiko` as never)}>
        {risikoTerbuka.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Tidak ada risiko terbuka.
          </Text>
        ) : (
          risikoTerbuka.slice(0, 3).map((rs, i) => (
            <ListRow
              key={rs.id}
              leading={<Badge tone={nadaLevel(rs.level)}>{LABEL_LEVEL[rs.level]}</Badge>}
              title={rs.title}
              subtitle={[rs.owner?.name, rs.task?.code].filter(Boolean).join(' · ') || 'Tanpa pemilik'}
              divider={i > 0}
              onPress={() => router.push(`${k}/risiko` as never)}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>

      <Panel title={`Tugas terlambat · ${d.overdue_tasks.length}`} actionLabel={d.overdue_tasks.length > 0 ? 'Semua' : undefined} onAction={() => router.push(`${k}/tim?tab=terlambat` as never)}>
        {d.overdue_tasks.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Tidak ada tugas terlambat.
          </Text>
        ) : (
          d.overdue_tasks.slice(0, 3).map((t, i) => (
            <ListRow
              key={t.id}
              title={t.title}
              subtitle={`${t.code} · tenggat ${hariTanggal(t.due_date)}`}
              trailing={t.assignee ? <Avatar name={t.assignee.name} size="sm" /> : undefined}
              onPress={() => bukaTugas(t.id)}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>

      <Panel title="Tim & beban" actionLabel={d.team_load.members.length > 0 ? 'Semua' : undefined} onAction={() => router.push(`${k}/tim?tab=tim` as never)}>
        {d.team_load.members.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            Belum ada tugas terbuka yang ditugaskan.
          </Text>
        ) : (
          d.team_load.members.slice(0, 4).map((t, i) => (
            <ListRow
              key={t.person.id}
              leading={<Avatar name={t.person.name} />}
              title={t.person.name}
              trailing={<Text variant="label">{`${t.open} terbuka`}</Text>}
              divider={i > 0}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>

      {can.post_update || can.manage_milestones ? (
        <DesktopOnlyBanner message="Ubah atribut proyek (PIC, sponsor, tanggal, status) tersedia di desktop." onSendLink={mengirim ? undefined : () => void kirim(`/w/${keyProyek}/ringkasan`)} />
      ) : null}

      {aksi.elemen}
      <RumusSheet proyek={p} visible={rumus} onClose={() => setRumus(false)} />
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={p.name}>
        <SheetAction icon="info" label="Dari mana angka ini?" onPress={() => { setMenu(false); setRumus(true); }} />
        <SheetAction icon="history" label="Riwayat update" onPress={() => { setMenu(false); router.push(`${k}/riwayat` as never); }} />
        <SheetAction icon="triangle-alert" label="Risiko proyek" onPress={() => { setMenu(false); router.push(`${k}/risiko` as never); }} />
        <SheetAction icon="users" label="Tugas terlambat & tim" onPress={() => { setMenu(false); router.push(`${k}/tim` as never); }} />
        <SheetAction icon="folder-kanban" label="Buka workspace" onPress={() => { setMenu(false); router.push(`/workspace/${encodeURIComponent(keyProyek)}` as never); }} />
        <SheetAction icon="monitor" label="Ubah atribut & ekspor (desktop)" description="Kirim tautan ke email saya" onPress={() => { setMenu(false); void kirim(`/w/${keyProyek}/ringkasan`); }} />
      </BottomSheet>
    </Screen>
  );
}

function Orang({ label, nama }: { label: string; nama: string | null }): React.JSX.Element {
  return (
    <View style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${label}: ${nama ?? 'belum ditetapkan'}`}>
      <Text variant="meta">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {nama ? <Avatar name={nama} size="sm" /> : null}
        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
          {nama ?? '—'}
        </Text>
      </View>
    </View>
  );
}

function Nilai({ label, nilai }: { label: string; nilai: string }): React.JSX.Element {
  return (
    <View style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${label}: ${nilai}`}>
      <Text variant="meta">{label}</Text>
      <Text variant="label">{nilai}</Text>
    </View>
  );
}
