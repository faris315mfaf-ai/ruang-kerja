/**
 * Alur persetujuan per langkah (mockup 19/20): "Diajukan oleh …" ✓ →
 * Langkah n ● menunggu → Langkah n+1 ○. Status = ikon + teks, bukan warna saja.
 */
import { View } from 'react-native';

import type { DetailPengajuan, LangkahTimeline } from '@/api/persetujuan';
import { fontFamily, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { jamTitik, lamaSejak, tanggalBerhari } from './format';

type Nada = 'selesai' | 'tunggu' | 'antre' | 'tolak' | 'revisi' | 'lewat';

function nadaLangkah(status: LangkahTimeline['status']): Nada {
  switch (status) {
    case 'approved':
      return 'selesai';
    case 'waiting':
      return 'tunggu';
    case 'rejected':
      return 'tolak';
    case 'revision_requested':
      return 'revisi';
    case 'skipped':
      return 'lewat';
    default:
      return 'antre';
  }
}

function Titik({ nada, nomor }: { nada: Nada; nomor: number | null }): React.JSX.Element {
  const { colors } = useTheme();
  const dasar = { width: 30, height: 30, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (nada === 'selesai') {
    return (
      <View style={[dasar, { backgroundColor: colors.success }]}>
        <Icon name="check" size={17} color={colors.surface} strokeWidth={2.6} />
      </View>
    );
  }
  if (nada === 'tolak') {
    return (
      <View style={[dasar, { backgroundColor: colors.danger }]}>
        <Icon name="x" size={17} color={colors.surface} strokeWidth={2.6} />
      </View>
    );
  }
  if (nada === 'revisi') {
    return (
      <View style={[dasar, { backgroundColor: colors.info }]}>
        <Icon name="square-pen" size={15} color={colors.surface} strokeWidth={2.4} />
      </View>
    );
  }
  if (nada === 'tunggu') {
    return (
      <View style={[dasar, { borderWidth: 3, borderColor: colors.warning, backgroundColor: colors.surface }]}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.warning }} />
      </View>
    );
  }
  return (
    <View style={[dasar, { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
      <Text variant="meta" weight={700} tone="muted">
        {nada === 'lewat' ? '–' : String(nomor ?? '')}
      </Text>
    </View>
  );
}

function Simpul({ nada, nomor, judul, sub, subTone, catatan, akhir }: { nada: Nada; nomor: number | null; judul: string; sub: React.ReactNode; subTone?: 'warning' | 'muted' | 'danger' | 'success' | 'info'; catatan?: string | null; akhir: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 14 }} accessible accessibilityLabel={`${judul}. ${typeof sub === 'string' ? sub : ''}${catatan ? `. Catatan: ${catatan}` : ''}`}>
      <View style={{ alignItems: 'center', width: 30 }}>
        <Titik nada={nada} nomor={nomor} />
        {!akhir ? <View style={{ flex: 1, width: 2, minHeight: 16, backgroundColor: colors.border }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: akhir ? 0 : 16, gap: 2 }}>
        <Text variant="title" weight={600} style={{ fontSize: 18 }}>
          {judul}
        </Text>
        <Text variant="body" tone={subTone ?? 'muted'} weight={subTone === 'warning' ? 600 : 400} style={{ fontSize: 15, lineHeight: 21 }}>
          {sub}
        </Text>
        {catatan ? (
          <Text variant="body" style={{ fontSize: 15, lineHeight: 21, marginTop: 4 }}>{`“${catatan}”`}</Text>
        ) : null}
      </View>
    </View>
  );
}

function namaPenyetuju(l: LangkahTimeline, sayaId: string | null): string {
  const nama = l.approver?.name ?? null;
  const saya = l.approver?.id === sayaId;
  if (l.delegated_from) {
    return `${l.delegated_from.name} · diwakili ${saya ? `Anda (${nama ?? ''})` : (nama ?? 'pengganti')}`;
  }
  if (!nama) {
    return l.status === 'queued' ? '' : 'Pemegang peran';
  }
  return saya ? `${nama} (Anda)` : nama;
}

export function TimelinePersetujuan({ request, sayaId }: { request: DetailPengajuan; sayaId: string | null }): React.JSX.Element {
  const langkah = request.timeline;
  const urutan = [...langkah].sort((a, b) => a.round - b.round || a.step_order - b.step_order);
  const diajukan = request.submitted_at ?? request.created_at;
  const mono = { fontFamily: fontFamily.mono500 };
  return (
    <View>
      <Simpul
        nada="selesai"
        nomor={null}
        judul={`Diajukan oleh ${request.user.name}`}
        sub={
          <>
            {tanggalBerhari(diajukan)}
            <Text variant="body" tone="muted" style={[{ fontSize: 15 }, mono]}>{` · ${jamTitik(diajukan)}`}</Text>
          </>
        }
        akhir={urutan.length === 0}
      />
      {urutan.map((l, i) => {
        const nada = nadaLangkah(l.status);
        const siapa = namaPenyetuju(l, sayaId);
        const putaran = l.current_round ? '' : `Putaran ${l.round} · `;
        let sub: string;
        let subTone: 'warning' | 'muted' | 'danger' | 'success' | 'info' = 'muted';
        if (nada === 'tunggu') {
          const lama = lamaSejak(l.activated_at);
          sub = [siapa, lama ? `menunggu sejak ${lama}` : 'menunggu'].filter(Boolean).join(' · ');
          subTone = 'warning';
        } else if (nada === 'antre') {
          const syarat = l.step_order > 1 ? `setelah langkah ${l.step_order - 1} disetujui` : 'menunggu giliran';
          sub = siapa ? `${siapa} · ${syarat}` : syarat.charAt(0).toUpperCase() + syarat.slice(1);
        } else if (nada === 'lewat') {
          sub = l.status_label;
        } else {
          sub = [siapa, `${l.status_label.toLowerCase()} ${tanggalBerhari(l.decided_at)}`].filter(Boolean).join(' · ');
          subTone = nada === 'tolak' ? 'danger' : nada === 'revisi' ? 'info' : 'muted';
        }
        return <Simpul key={l.id} nada={nada} nomor={l.step_order} judul={`${putaran}Langkah ${l.step_order} · ${l.label}`} sub={sub} subTone={subTone} catatan={l.note} akhir={i === urutan.length - 1} />;
      })}
    </View>
  );
}
