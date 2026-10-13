/**
 * Potongan tampilan pengajuan untuk Persetujuan: isi kartu tumpukan
 * (mockup 17), baris daftar (18), peringatan rekan, lencana "Mewakili".
 */
import { View } from 'react-native';

import type { DetailPersetujuan, ItemAntrean, RekanAbsen, StatusLangkah } from '@/api/persetujuan';
import { fontFamily, radius, useTheme } from '@/theme';
import { Avatar, Badge, Icon, Pressable, Skeleton, Tag, Text, type Tone } from '@/ui';

import { dampakRekan, diajukan, langkahTeks, nadaKategori, namaDepan, periode, ringkasRekan, saldoTeks, tanggalTanpaTahun } from './format';

export function nadaLangkah(status: StatusLangkah | string): Tone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'revision_requested':
      return 'info';
    case 'waiting':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Lencana "Mewakili Dimas" (penerima delegasi). */
export function LencanaMewakili({ nama }: { nama: string }): React.JSX.Element {
  return <Badge tone="info" dot={false}>{`Mewakili ${namaDepan(nama)}`}</Badge>;
}

/** Baris periode: teks utama + bagian jam (mono) + keterangan. */
export function BarisPeriode({ item, besar = false }: { item: ItemAntrean; besar?: boolean }): React.JSX.Element {
  const p = periode(item);
  if (besar) {
    return (
      <View style={{ gap: 2 }}>
        <Text variant="h1" weight={800}>
          {p.utama}
          {p.jam ? (
            <Text variant="h1" style={{ fontFamily: fontFamily.mono600 }}>
              {` · ${p.jam}`}
            </Text>
          ) : null}
        </Text>
        {p.keterangan ? (
          <Text variant="bodyLg" tone="muted">
            {p.keterangan}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <Text variant="body" tone="muted" numberOfLines={2}>
      {p.utama}
      {p.jam ? <Text variant="body" weight={600} style={{ fontFamily: fontFamily.mono600 }}>{` · ${p.jam}`}</Text> : null}
      {p.keterangan ? ` · ${p.keterangan}` : ''}
    </Text>
  );
}

/** Kotak peringatan rekan ("Nadia Putri juga tidak masuk pada 20 Okt. Tim Gudang kurang 2 dari 6 orang hari itu."). */
export function PeringatanRekan({ rekan, ringkas = false }: { rekan: RekanAbsen | null | undefined; ringkas?: boolean }): React.JSX.Element | null {
  const { colors } = useTheme();
  const ringkasan = ringkasRekan(rekan);
  if (!ringkasan) {
    return null;
  }
  if (ringkas) {
    return (
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} accessibilityRole="text">
        <Icon name="triangle-alert" size={16} color={colors.warning} style={{ marginTop: 1 }} />
        <Text variant="meta" tone="warning" weight={600} style={{ flex: 1, fontSize: 14 }} numberOfLines={2}>
          {ringkasan}
        </Text>
      </View>
    );
  }
  const dampak = dampakRekan(rekan);
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.warningSoft }} accessibilityRole="text">
      <Icon name="triangle-alert" size={20} color={colors.warning} style={{ marginTop: 2 }} />
      <Text variant="body" tone="warning" style={{ flex: 1, fontSize: 16, lineHeight: 23 }}>
        <Text variant="body" tone="warning" weight={700} style={{ fontSize: 16, lineHeight: 23 }}>
          {`${ringkasan}.`}
        </Text>
        {dampak ? ` ${dampak}` : ''}
      </Text>
    </View>
  );
}

/** Kotak saldo "Saldo cuti   12 → 9 hari setelah disetujui" (hanya non-staf: server tidak mengirim ke staf). */
export function KotakSaldo({ detail }: { detail: DetailPersetujuan | null }): React.JSX.Element | null {
  const { colors } = useTheme();
  const saldo = saldoTeks(detail?.request);
  if (!saldo) {
    return null;
  }
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.lg, backgroundColor: colors.surface2 }}
      accessible
      accessibilityLabel={`Saldo cuti ${saldo.sebelum} menjadi ${saldo.sesudah} hari setelah disetujui`}
    >
      <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
        Saldo cuti
      </Text>
      <Text variant="body" style={{ flex: 1, textAlign: 'right', fontSize: 16 }}>
        <Text variant="body" weight={700} style={{ fontSize: 16 }}>{`${saldo.sebelum} → ${saldo.sesudah} hari`}</Text>
        <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
          {' setelah disetujui'}
        </Text>
      </Text>
    </View>
  );
}

/** Isi kartu tumpukan (mockup 17 p1). `detail` memperkaya alasan, saldo, pengganti, lampiran. */
export function IsiKartuTumpukan({
  item,
  detail,
  memuatDetail,
  onDetail,
}: {
  item: ItemAntrean;
  detail: DetailPersetujuan | null;
  memuatDetail: boolean;
  onDetail: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const req = detail?.request ?? null;
  const langkah = langkahTeks(item);
  const mewakili = item.step?.on_behalf_of ?? detail?.my_step?.on_behalf_of ?? null;
  const jumlahLampiran = req?.attachments.length ?? 0;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={item.user.name} size="lg" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" numberOfLines={2}>
            {item.user.name}
          </Text>
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {diajukan(item)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Tag tone={nadaKategori(item.type.category)}>{item.type.name}</Tag>
        {langkah ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {langkah}
          </Text>
        ) : null}
        {mewakili ? <LencanaMewakili nama={mewakili.name} /> : null}
      </View>
      <BarisPeriode item={item} besar />
      {memuatDetail && !req ? (
        <View style={{ gap: 8 }} accessibilityLabel="Memuat rincian">
          <Skeleton height={48} />
          <Skeleton width="70%" />
        </View>
      ) : null}
      <KotakSaldo detail={detail} />
      {req?.health_details_hidden ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="shield-off" size={18} color={colors.muted} />
          <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 15 }}>
            Detail kesehatan disembunyikan untuk penyetuju pengganti
          </Text>
        </View>
      ) : req && req.reason.trim() !== '' ? (
        <Text variant="bodyLg" numberOfLines={4}>{`“${req.reason.trim()}”`}</Text>
      ) : null}
      {req?.substitute ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={req.substitute.name} size="sm" />
          <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 15 }}>{`Pengganti: ${req.substitute.name}`}</Text>
        </View>
      ) : null}
      {jumlahLampiran > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="paperclip" size={18} color={colors.muted} />
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>{`${jumlahLampiran} lampiran`}</Text>
        </View>
      ) : null}
      <PeringatanRekan rekan={item.colleagues ?? req?.colleagues ?? null} />
      <Pressable
        onPress={onDetail}
        accessibilityRole="link"
        accessibilityLabel={`Lihat detail pengajuan ${item.user.name}`}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Text variant="title" tone="link" weight={700}>
          Lihat detail
        </Text>
        <Icon name="chevron-right" size={20} color={colors.link} />
      </Pressable>
    </View>
  );
}

/** Baris daftar persetujuan (mockup 18 p1/p3/p4, 24 p3). */
export function KartuAntrean({
  item,
  tab,
  onPress,
  aksi,
}: {
  item: ItemAntrean;
  tab: 'menunggu' | 'diputus' | 'disetujui';
  onPress: () => void;
  /** Aksi TalkBack (Setujui/Tolak) untuk baris menunggu. */
  aksi?: { name: string; label: string; onPress: () => void }[];
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const langkah = langkahTeks(item);
  const mewakili = item.step?.on_behalf_of ?? item.my_decision?.on_behalf_of ?? null;
  const meta =
    tab === 'menunggu'
      ? [diajukan(item), langkah].filter(Boolean).join(' · ')
      : tab === 'disetujui'
        ? `Disetujui ${tanggalTanpaTahun(item.decided_at)}`
        : item.my_decision
          ? `${item.my_decision.status_label} ${tanggalTanpaTahun(item.my_decision.decided_at)}`
          : item.status_label;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.user.name}, ${item.type.name}, ${periode(item).utama}. ${meta}${mewakili ? `. Mewakili ${mewakili.name}` : ''}`}
      accessibilityHint="Buka detail pengajuan"
      accessibilityActions={aksi?.map((a) => ({ name: a.name, label: a.label }))}
      onAccessibilityAction={(e) => aksi?.find((a) => a.name === e.nativeEvent.actionName)?.onPress()}
      style={{
        flexDirection: 'row',
        gap: 14,
        padding: 18,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        boxShadow: shadows.card,
      }}
    >
      <Avatar name={item.user.name} size="md" />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="title" weight={700} style={{ flex: 1, fontSize: 18 }} numberOfLines={1}>
            {item.user.name}
          </Text>
          {mewakili ? <LencanaMewakili nama={mewakili.name} /> : null}
        </View>
        <BarisPeriode item={item} />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Tag tone={nadaKategori(item.type.category)}>{item.type.name}</Tag>
          {tab === 'diputus' && item.my_decision ? (
            <Badge tone={nadaLangkah(item.my_decision.status)}>{item.my_decision.status_label}</Badge>
          ) : null}
          <Text variant="meta" style={{ fontSize: 14, flexShrink: 1 }}>
            {tab === 'diputus' && item.my_decision ? tanggalTanpaTahun(item.my_decision.decided_at) : meta}
          </Text>
        </View>
        {tab === 'menunggu' ? <PeringatanRekan rekan={item.colleagues} ringkas /> : null}
      </View>
      <Icon name="chevron-right" size={20} color={colors.subtle} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}
