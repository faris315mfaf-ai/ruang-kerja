/** Komentar: kartu (avatar, isi kaya, reaksi, "Dibaca oleh"), sheet aksi, sheet pembaca. */
import { StyleSheet, View } from 'react-native';

import { EMOJI_REAKSI, type KomentarTugas, type PembacaKomentar } from '@/api/tugas';
import { jam, waktuRelatif } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, AvatarStack, BottomSheet, Icon, Pressable, SheetAction, Text } from '@/ui';

import { HtmlText } from './HtmlText';

/** Pembaca (bukan penulis/saya) yang sudah membaca sampai komentar ini. */
export function pembacaKomentar(k: KomentarTugas, pembaca: PembacaKomentar[], idSaya: string | null): PembacaKomentar[] {
  if (!k.created_at) {
    return [];
  }
  const waktu = new Date(k.created_at).getTime();
  return pembaca.filter((p) => p.user.id !== k.author?.id && p.user.id !== idSaya && new Date(p.last_read_at).getTime() >= waktu);
}

export function KomentarItem({
  k,
  pembaca,
  onReaksi,
  onAksi,
  onPembaca,
}: {
  k: KomentarTugas;
  pembaca: PembacaKomentar[];
  onReaksi: (k: KomentarTugas, emoji: string) => void;
  onAksi: (k: KomentarTugas) => void;
  onPembaca: (k: KomentarTugas) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  if (k.deleted) {
    return (
      <View style={[s.kartu, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <View style={s.baris}>
          <Icon name="trash-2" size={18} color={colors.subtle} />
          <Text variant="label" tone="subtle">
            Komentar dihapus
          </Text>
          <Text variant="meta">· {waktuRelatif(k.created_at)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.baris}>
        <Avatar name={k.author?.name ?? '?'} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="label" weight={700} numberOfLines={1}>
            {k.author?.name ?? 'Tidak dikenal'}
          </Text>
          <Text variant="meta">
            {waktuRelatif(k.created_at)}
            {k.edited_at ? ' (diedit)' : ''}
          </Text>
        </View>
        <Pressable onPress={() => onAksi(k)} accessibilityRole="button" accessibilityLabel="Aksi komentar" hitSlop={8} style={s.ikon}>
          <Icon name="ellipsis" size={22} color={colors.muted} />
        </Pressable>
      </View>
      <HtmlText html={k.body_html} fallback={k.body_text} />
      <View style={s.reaksi}>
        {k.reactions.map((r) => {
          const aktif = k.my_reactions.includes(r.emoji);
          return (
            <Pressable
              key={r.emoji}
              onPress={() => onReaksi(k, r.emoji)}
              disabled={!k.can.react}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={`Reaksi ${r.emoji}, ${r.count} orang${aktif ? ', termasuk Anda' : ''}`}
              accessibilityState={{ selected: aktif }}
              style={[s.chip, { backgroundColor: aktif ? colors.linkSoft : colors.surface2, borderColor: aktif ? colors.primary : 'transparent' }]}
            >
              <Text style={{ fontSize: 15 }} maxFontSizeMultiplier={1.3}>
                {r.emoji}
              </Text>
              <Text variant="label" tone={aktif ? 'link' : 'muted'}>
                {r.count}
              </Text>
            </Pressable>
          );
        })}
        {k.can.react ? (
          <Pressable onPress={() => onAksi(k)} accessibilityRole="button" accessibilityLabel="Tambah reaksi" style={[s.chip, { borderStyle: 'dashed', borderColor: colors.borderStrong }]}>
            <Icon name="smile-plus" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
        {pembaca.length > 0 ? (
          <Pressable onPress={() => onPembaca(k)} accessibilityRole="button" accessibilityLabel={`Dibaca oleh ${pembaca.length} orang`} style={s.pembaca} hitSlop={6}>
            <Icon name="check-check" size={16} color={colors.link} />
            <Text variant="meta" tone="link" weight={600}>
              Dibaca oleh {pembaca.length}
            </Text>
            <AvatarStack names={pembaca.map((p) => p.user.name)} max={3} size="sm" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SheetAksiKomentar({
  k,
  onClose,
  onReaksi,
  onSunting,
  onHapus,
}: {
  k: KomentarTugas | null;
  onClose: () => void;
  onReaksi: (k: KomentarTugas, emoji: string) => void;
  onSunting: (k: KomentarTugas) => void;
  onHapus: (k: KomentarTugas) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={k !== null} onClose={onClose}>
      {k ? (
        <>
          {k.can.react ? (
            <View style={s.emoji}>
              {EMOJI_REAKSI.map((e) => {
                const aktif = k.my_reactions.includes(e);
                return (
                  <Pressable
                    key={e}
                    scaleTo={0.9}
                    onPress={() => {
                      onClose();
                      onReaksi(k, e);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Reaksi ${e}`}
                    accessibilityState={{ selected: aktif }}
                    style={[s.bulat, { backgroundColor: aktif ? colors.linkSoft : colors.surface2, borderColor: aktif ? colors.primary : 'transparent' }]}
                  >
                    <Text style={{ fontSize: 22, lineHeight: 28 }} maxFontSizeMultiplier={1.2}>
                      {e}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {k.can.edit ? (
            <SheetAction icon="pencil" label="Sunting" description="Komentar Anda" onPress={() => { onClose(); onSunting(k); }} />
          ) : null}
          {k.can.delete ? (
            <SheetAction icon="trash-2" label="Hapus" tone="danger" description={k.mine ? 'Komentar Anda' : 'Moderator workspace'} onPress={() => { onClose(); onHapus(k); }} />
          ) : null}
          {!k.can.react && !k.can.edit && !k.can.delete ? <Text variant="body" tone="muted">Tidak ada aksi yang tersedia.</Text> : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

export function SheetPembaca({ visible, onClose, pembaca }: { visible: boolean; onClose: () => void; pembaca: PembacaKomentar[] }): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Dibaca oleh" showClose scrollable>
      {pembaca.length === 0 ? <Text variant="body" tone="muted">Belum ada yang membaca.</Text> : null}
      {pembaca.map((p) => (
        <View key={p.user.id} style={s.baris}>
          <Avatar name={p.user.name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="title">{p.user.name}</Text>
            <Text variant="meta">
              {waktuRelatif(p.last_read_at)} · {jam(p.last_read_at)}
            </Text>
          </View>
        </View>
      ))}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kartu: { borderRadius: radius.cardTight, borderWidth: 1, padding: 14, gap: 10 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ikon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  reaksi: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12 },
  pembaca: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  emoji: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingVertical: 4 },
  bulat: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
