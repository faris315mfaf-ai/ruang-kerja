/** Potongan UI bersama modul Hiring (mockup 11 › 07–18). Token saja, tanpa hex. */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { KartuKandidat, OrangHiring, RingkasHiring } from '@/api/hiring';
import { jam, waktuRelatif } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, Button, Card, Icon, IconButton, LockedState, Pressable, Screen, SubAppBar, TabNav, Text } from '@/ui';

import { nadaTahap } from './format';

export type TabHiring = 'kandidat' | 'lowongan' | 'pengaturan';

/** Kalimat ringkas di bawah judul: "2 lowongan dibuka · 4 kandidat baru · 1 menunggu keputusan". */
export function ringkasanHiring(h: RingkasHiring | null): string | null {
  if (!h) {
    return null;
  }
  const c = h.counts;
  if (h.can_manage) {
    return `${c.open_positions} lowongan dibuka · ${c.new_candidates} kandidat baru · ${c.awaiting_decision} menunggu keputusan`;
  }
  return c.awaiting_decision > 0 ? `${c.awaiting_decision} menunggu keputusan Anda` : `${c.open_positions} lowongan dibuka`;
}

/** Bilah atas Hiring: judul, ringkasan, dan tab bergaris bawah (Pengaturan hanya HR/SA). */
export function KepalaHiring({
  tab,
  onTab,
  hiring,
  memuat,
}: {
  tab: TabHiring;
  onTab: (t: TabHiring) => void;
  hiring: RingkasHiring | null;
  memuat: boolean;
}): React.JSX.Element {
  const ringkas = ringkasanHiring(hiring);
  const opsi: { value: TabHiring; label: string }[] = [
    { value: 'kandidat', label: 'Kandidat' },
    { value: 'lowongan', label: 'Lowongan' },
  ];
  if (hiring?.can_manage) {
    opsi.push({ value: 'pengaturan', label: 'Pengaturan' });
  }
  return (
    <View>
      <SubAppBar title="Hiring" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text variant="body" tone="muted" numberOfLines={2}>
          {ringkas ?? (memuat ? 'Memuat…' : ' ')}
        </Text>
      </View>
      <TabNav value={tab} options={opsi} onChange={onTab} />
    </View>
  );
}

/** 404 generik (D22): keberadaan data tidak dibocorkan. */
export function HalamanTidakDitemukan({ judul = 'Hiring', alasan }: { judul?: string; alasan?: string }): React.JSX.Element {
  return (
    <Screen header={<SubAppBar title={judul} />} contentStyle={{ paddingTop: 24 }}>
      <LockedState
        title="Halaman tidak ditemukan"
        reason={alasan ?? 'Ruang Hiring hanya untuk HR, Super Admin, serta pewawancara dan penyetuju yang ditugaskan.'}
        actionLabel="Kembali"
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
      />
    </Screen>
  );
}

/** Banner offline ringkas: data di layar dari muatan terakhir (memori saja). */
export function BannerOffline({ sejak, pesan }: { sejak: number; pesan?: string }): React.JSX.Element {
  return <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Data dimuat pukul ${jam(new Date(sejak))}; ${pesan ?? 'perubahan butuh koneksi.'}`} />;
}

/** Baris orang: avatar inisial + nama + jabatan, aksi kanan opsional. */
export function BarisOrang({
  orang,
  kanan,
  catatan,
  divider = false,
}: {
  orang: OrangHiring;
  kanan?: React.ReactNode;
  catatan?: string;
  divider?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const nonaktif = orang.active === false;
  return (
    <View style={[s.orang, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
      <Avatar name={orang.name} size="sm" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={2}>
          {orang.name}
        </Text>
        {orang.position || catatan || nonaktif ? (
          <Text variant="meta" numberOfLines={2}>
            {[nonaktif ? 'Nonaktif' : null, orang.position, catatan].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {kanan}
    </View>
  );
}

/** Tombol hapus orang dari daftar (48 dp). */
export function TombolLepas({ nama, onPress, disabled }: { nama: string; onPress: () => void; disabled?: boolean }): React.JSX.Element {
  return <IconButton icon="x" label={`Lepas ${nama}`} variant="ghost" onPress={onPress} disabled={disabled} />;
}

/** Kartu kandidat (mockup 07): nama, lowongan, waktu melamar, checklist n/m, tahap, aksi pindah. */
export function KartuKandidatItem({
  k,
  tampilTahap,
  onPress,
  onPindah,
  pindahNonaktif,
}: {
  k: KartuKandidat;
  tampilTahap: boolean;
  onPress: () => void;
  onPindah?: () => void;
  pindahNonaktif?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const lengkap = k.checklist.total > 0 && k.checklist.done >= k.checklist.total;
  return (
    <Card variant="tight" style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={onPress}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel={`${k.full_name}, ${k.position.title}, tahap ${k.stage_label}, checklist ${k.checklist.done} dari ${k.checklist.total}${k.awaiting_me ? ', menunggu keputusan Anda' : ''}`}
        style={{ padding: 16, gap: 8, minHeight: 72 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Avatar name={k.full_name} size="md" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{k.full_name}</Text>
            <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={2}>
              {k.position.title}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.muted} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {k.awaiting_me ? (
            <Badge tone="warning" dot>
              Menunggu keputusan Anda
            </Badge>
          ) : null}
          {tampilTahap || k.stage === 'hired' || k.stage === 'rejected' ? (
            <Badge tone={nadaTahap(k.stage)} dot>
              {k.stage_label}
            </Badge>
          ) : null}
          {k.source === 'manual' ? <Badge tone="neutral">Manual</Badge> : null}
          <Text variant="meta" style={{ flex: 1, fontSize: 14 }}>
            {waktuRelatif(k.applied_at)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name={lengkap ? 'circle-check' : 'list-checks'} size={16} color={lengkap ? colors.success : colors.muted} />
            <Text variant="meta" weight={700} tone={lengkap ? 'success' : 'muted'} style={{ fontSize: 14 }}>
              {`${k.checklist.done}/${k.checklist.total}`}
            </Text>
          </View>
        </View>
      </Pressable>
      {onPindah ? (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Button
            title={k.stage === 'hired' || k.stage === 'rejected' ? 'Buka kembali…' : 'Pindahkan ke…'}
            variant="quiet"
            icon="arrow-right-left"
            onPress={onPindah}
            disabled={pindahNonaktif}
            disabledReason={pindahNonaktif ? 'Butuh koneksi' : undefined}
            accessibilityHint={`Pindahkan ${k.full_name} ke tahap lain`}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  orang: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
});
