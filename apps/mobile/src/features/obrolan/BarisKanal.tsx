/**
 * Baris daftar percakapan (mockup 01): ubin, judul, pratinjau, waktu, lencana
 * belum dibaca, ikon bisu, "Belum bergabung". Aksen teal di tepi kiri bila ada
 * pesan baru. Tahan lama = aksi baris.
 */
import { StyleSheet, View } from 'react-native';

import type { KanalRingkas } from '@/api/obrolan';
import { useTheme } from '@/theme';
import { Badge, CountBadge, Icon, Pressable, Text } from '@/ui';

import { UbinKanal } from './UbinKanal';
import { kanalDibisukan, namaKanal, pratinjauKanal, waktuDaftar } from './util';

export function BarisKanal({
  kanal,
  saya,
  divider,
  onTekan,
  onTekanLama,
}: {
  kanal: KanalRingkas;
  saya: string | null;
  divider: boolean;
  onTekan: () => void;
  onTekanLama: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const belum = kanal.unread_count > 0;
  const bisu = kanalDibisukan(kanal, saya);
  const judul = namaKanal(kanal);
  const waktu = waktuDaftar(kanal.last_message?.created_at ?? null);

  return (
    <Pressable
      onPress={onTekan}
      onLongPress={onTekanLama}
      delayLongPress={350}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={`${judul}${belum ? `, ${kanal.unread_count} belum dibaca` : ''}${bisu ? ', dibisukan' : ''}${kanal.is_member ? '' : ', belum bergabung'}`}
      accessibilityActions={[{ name: 'aksi', label: 'Buka aksi percakapan' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'aksi') {
          onTekanLama();
        }
      }}
      style={[s.baris, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
    >
      {belum ? <View style={[s.aksen, { backgroundColor: colors.primary }]} /> : null}
      <UbinKanal jenis={kanal.type} nama={judul} workspace={kanal.workspace} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.judulBaris}>
          <Text variant="title" weight={belum ? 800 : 600} numberOfLines={1} style={{ flexShrink: 1 }}>
            {judul}
          </Text>
          {bisu ? <Icon name="bell-off" size={16} color={colors.subtle} /> : null}
          {!kanal.is_member ? (
            <Badge tone="neutral" dot={false}>
              Belum bergabung
            </Badge>
          ) : null}
        </View>
        <Text variant="body" tone={belum ? 'text' : 'muted'} weight={belum ? 600 : 400} numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>
          {pratinjauKanal(kanal, saya)}
        </Text>
      </View>
      <View style={s.kanan}>
        <Text variant="meta" weight={belum ? 700 : 500} tone={belum ? 'link' : 'muted'}>
          {waktu}
        </Text>
        {belum ? <CountBadge count={kanal.unread_count} style={{ position: 'relative', top: 0, right: 0, borderWidth: 0 }} /> : <View style={{ height: 20 }} />}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingHorizontal: 16, paddingVertical: 10 },
  aksen: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  judulBaris: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kanan: { alignItems: 'flex-end', gap: 4, minWidth: 44 },
});
