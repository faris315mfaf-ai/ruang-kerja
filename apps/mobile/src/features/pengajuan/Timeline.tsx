/**
 * Timeline "Alur persetujuan" (mockup 13–15, 25–26): Diajukan ✓ → langkah per
 * putaran (✓ disetujui, ● menunggu, ✕ ditolak, ↩ revisi, ○ antre / dilewati)
 * dengan penyetuju, "mewakili", catatan, dan waktu → Dibatalkan (bila ada).
 */
import { StyleSheet, View } from 'react-native';

import type { DetailPengajuan, LangkahTimeline } from '@/api/pengajuan';
import { radius, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';
import type { AnyIconName } from '@/ui/Icon';

import { hariTanggalPendek, jamKantor, namaDepan, sejak, tanggalTanpaTahun } from './format';

type Nada = 'ok' | 'wait' | 'bad' | 'info' | 'idle' | 'mute';

function Penanda({ nada, angka, ikon }: { nada: Nada; angka?: number; ikon?: AnyIconName }): React.JSX.Element {
  const { colors } = useTheme();
  if (nada === 'idle') {
    return (
      <View style={[s.bulat, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
        <Text variant="meta" weight={700}>
          {angka ?? ''}
        </Text>
      </View>
    );
  }
  if (nada === 'wait') {
    return (
      <View style={[s.bulat, { borderWidth: 3, borderColor: colors.fill.warning, backgroundColor: colors.surface }]}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.fill.warning }} />
      </View>
    );
  }
  const bg = nada === 'ok' ? colors.success : nada === 'bad' ? colors.danger : nada === 'info' ? colors.info : colors.muted;
  return (
    <View style={[s.bulat, { backgroundColor: bg }]}>
      <Icon name={ikon ?? 'check'} size={16} color={colors.surface} strokeWidth={2.6} />
    </View>
  );
}

interface Baris {
  kunci: string;
  nada: Nada;
  ikon?: AnyIconName;
  angka?: number;
  judul: string;
  sub: string;
  subNada?: 'muted' | 'warning' | 'danger' | 'info';
  catatan?: string | null;
}

function barisLangkah(l: LangkahTimeline, d: DetailPengajuan): Baris {
  const nama = l.approver?.name ?? null;
  const wakil = l.delegated_from ? ` · mewakili ${namaDepan(l.delegated_from.name)}` : '';
  const judul = `Langkah ${l.step_order} · ${l.label}`;
  const putaran = d.round > 1 && !l.current_round ? ` (putaran ${l.round})` : '';
  switch (l.status) {
    case 'approved':
      return { kunci: l.id, nada: 'ok', judul: judul + putaran, sub: `${nama ?? l.label}${wakil} · disetujui ${tanggalTanpaTahun(l.decided_at)}`, catatan: l.note };
    case 'rejected':
      return { kunci: l.id, nada: 'bad', ikon: 'x', judul: judul + putaran, sub: `${nama ?? l.label}${wakil} · menolak ${tanggalTanpaTahun(l.decided_at)}`, subNada: 'danger', catatan: l.note };
    case 'revision_requested':
      return { kunci: l.id, nada: 'info', ikon: 'undo-2', judul: judul + putaran, sub: `${nama ?? l.label}${wakil} · meminta revisi ${tanggalTanpaTahun(l.decided_at)}`, subNada: 'info', catatan: l.note };
    case 'waiting':
      return {
        kunci: l.id,
        nada: 'wait',
        judul,
        sub: `${nama ?? `Siapa pun pemegang peran ${l.label}`}${wakil} · menunggu${l.activated_at ? ` sejak ${sejak(l.activated_at)}` : ''}`,
        subNada: 'warning',
      };
    case 'skipped':
      return { kunci: l.id, nada: 'idle', angka: l.step_order, judul, sub: 'Dilewati' };
    default: {
      let sub = `Setelah langkah ${l.step_order - 1} disetujui`;
      if (d.status === 'rejected' || d.status === 'canceled') {
        sub = 'Tidak diteruskan';
      } else if (d.status === 'revision_requested') {
        sub = 'Menunggu pengajuan dikirim ulang';
      } else if (d.status === 'draft') {
        sub = 'Setelah pengajuan dikirim';
      }
      return { kunci: l.id, nada: 'idle', angka: l.step_order, judul, sub };
    }
  }
}

export function TimelineAlur({ detail, diriSendiri = true }: { detail: DetailPengajuan; diriSendiri?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const baris: Baris[] = [];
  if (detail.submitted_at) {
    baris.push({
      kunci: 'diajukan',
      nada: 'ok',
      judul: diriSendiri ? 'Diajukan oleh Anda' : `Diajukan oleh ${detail.user.name}`,
      sub: `${hariTanggalPendek(detail.submitted_at)} · ${jamKantor(detail.submitted_at)}`,
    });
  }
  const langkah = [...detail.timeline].sort((a, b) => a.round - b.round || a.step_order - b.step_order);
  for (const l of langkah) {
    if (!l.current_round && l.status === 'queued') {
      continue;
    }
    baris.push(barisLangkah(l, detail));
  }
  if (detail.status === 'canceled' && detail.cancellation) {
    const c = detail.cancellation;
    baris.push({
      kunci: 'batal',
      nada: 'mute',
      ikon: 'ban',
      judul: c.by_requester ? (diriSendiri ? 'Dibatalkan oleh Anda' : `Dibatalkan oleh ${detail.user.name}`) : `Dibatalkan oleh ${c.by?.name ?? 'HR'}`,
      sub: `${tanggalTanpaTahun(c.at)}${c.after_approval ? ' · setelah disetujui' : ''}`,
    });
  }

  return (
    <View accessibilityRole="list">
      {baris.map((b, i) => {
        const terakhir = i === baris.length - 1;
        return (
          <View key={b.kunci} style={s.baris} accessible accessibilityLabel={`${b.judul}. ${b.sub}${b.catatan ? `. Catatan: ${b.catatan}` : ''}`}>
            <View style={s.kiri}>
              <Penanda nada={b.nada} angka={b.angka} ikon={b.ikon} />
              {!terakhir ? <View style={[s.garis, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={[s.kanan, { paddingBottom: terakhir ? 0 : 18 }]}>
              <Text variant="title" weight={600}>
                {b.judul}
              </Text>
              <Text variant="meta" tone={b.subNada ?? 'muted'}>
                {b.sub}
              </Text>
              {b.catatan ? (
                <View style={[s.catatan, { backgroundColor: colors.surface2 }]}>
                  <Text variant="label" weight={500}>
                    “{b.catatan}”
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 14 },
  kiri: { alignItems: 'center', width: 30 },
  bulat: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  garis: { width: 2, flex: 1, marginVertical: 2 },
  kanan: { flex: 1, gap: 2, paddingTop: 3 },
  catatan: { marginTop: 8, padding: 12, borderRadius: radius.lg },
});
