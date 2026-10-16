/**
 * Potongan UI bersama layar Lainnya, Profil, Pengaturan, dan Privasi:
 * label kelompok, daftar menu (kartu berisi baris), kartu identitas
 * gradien, dan baris label–nilai.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Avatar, Card, Hero, Icon, ListRow, Pressable, Text, type AnyIconName, type IconTileTone } from '@/ui';

export function GroupLabel({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }): React.JSX.Element {
  return (
    <View style={s.labelBaris}>
      <Text variant="overline" tone="muted" style={{ flex: 1 }} accessibilityRole="header">
        {children}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} scaleTo={1} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} accessibilityRole="link" accessibilityLabel={action}>
          <Text variant="label" tone="link">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface ItemMenu {
  kunci: string;
  judul: string;
  subjudul?: string;
  ikon: AnyIconName;
  nada?: IconTileTone;
  onPress?: () => void;
  /** Node kanan (lencana angka, status). Kosong + onPress = chevron. */
  kanan?: React.ReactNode;
  aksesibilitas?: string;
}

/** Kartu putih berisi baris menu dengan pemisah. */
export function DaftarMenu({ items }: { items: ItemMenu[] }): React.JSX.Element {
  return (
    <Card variant="flat">
      {items.map((item, indeks) => (
        <ListRow
          key={item.kunci}
          divider={indeks > 0}
          icon={item.ikon}
          iconTone={item.nada}
          title={item.judul}
          subtitle={item.subjudul}
          trailing={item.kanan}
          onPress={item.onPress}
          accessibilityLabel={item.aksesibilitas}
        />
      ))}
    </Card>
  );
}

/** Kartu identitas gradien: avatar bercincin + nama + jabatan (+ lencana). */
export function KartuIdentitas({
  nama,
  baris,
  lencana,
  onPress,
}: {
  nama: string;
  baris?: string;
  lencana?: React.ReactNode;
  onPress?: () => void;
}): React.JSX.Element {
  return (
    <Hero onPress={onPress} accessibilityLabel={`Profil ${nama}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20 }}>
      <View style={s.cincin}>
        <Avatar name={nama} size="lg" style={s.avatarPutih} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h3" tone="onPrimary" numberOfLines={2}>
          {nama}
        </Text>
        {baris ? (
          <Text variant="body" tone="onPrimary" style={{ fontSize: 15, lineHeight: 22, opacity: 0.92 }} numberOfLines={2}>
            {baris}
          </Text>
        ) : null}
        {lencana}
      </View>
      {onPress ? <Icon name="chevron-right" size={22} color="#FFFFFF" /> : null}
    </Hero>
  );
}

/** Lencana kecil di atas gradien (peran). */
export function LencanaPeran({ children, ikon }: { children: string; ikon?: AnyIconName }): React.JSX.Element {
  return (
    <View style={s.lencana}>
      {ikon ? <Icon name={ikon} size={14} color="#FFFFFF" /> : null}
      <Text variant="meta" weight={700} tone="onPrimary" style={{ fontSize: 13 }}>
        {children}
      </Text>
    </View>
  );
}

/** Baris label (kiri, muted) – nilai (kanan, tebal). */
export function BarisNilai({ label, nilai, sub, divider = true }: { label: string; nilai: string; sub?: string | null; divider?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.nilai, divider ? [s.garis, { borderBottomColor: colors.divider }] : null]}>
      <Text variant="body" tone="muted" style={{ fontSize: 16, flexShrink: 0 }}>
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
        <Text variant="body" weight={700} align="right" style={{ fontSize: 16 }} selectable>
          {nilai}
        </Text>
        {sub ? (
          <Text variant="meta" align="right">
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  labelBaris: { flexDirection: 'row', alignItems: 'center', minHeight: 32, paddingHorizontal: 4, marginTop: 4 },
  cincin: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  avatarPutih: { backgroundColor: 'rgba(255,255,255,0.22)' },
  lencana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 6,
  },
  nilai: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
  garis: { borderBottomWidth: StyleSheet.hairlineWidth },
});
