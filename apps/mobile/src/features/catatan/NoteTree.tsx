/** Panel pohon catatan per workspace: folder, catatan, sub-halaman, gembok, peran, menu aksi. */
import { StyleSheet, View } from 'react-native';

import type { PohonNode } from '@/api/catatan';
import { ChipMenunggu } from '@/offline/ChipMenunggu';
import { useTheme } from '@/theme';
import { Badge, Card, Gradient, Icon, Pressable, Text, type AnyIconName } from '@/ui';
import type { GradientName } from '@/theme';

import { hitungCatatan, infoDiubah, labelItem, ratakan } from './pohon';

export interface RuangPanel {
  id: string;
  key: string;
  name: string;
  archived: boolean;
  personal: boolean;
}

function ikonNode(node: PohonNode, terbuka: boolean): AnyIconName {
  if (node.kind === 'folder') {
    return terbuka ? 'folder-open' : 'folder';
  }
  return node.preset === 'minutes' ? 'notebook-pen' : 'file-text';
}

export function KepalaWorkspace({ ruang, jumlah }: { ruang: RuangPanel; jumlah: number }): React.JSX.Element {
  const { colors } = useTheme();
  const gradien: GradientName = ruang.personal ? 'slate' : 'merek';
  return (
    <View style={[s.kepala, { borderBottomColor: colors.divider }]}>
      <Gradient name={gradien} style={s.lencana}>
        <Text variant="meta" weight={800} style={{ color: '#FFFFFF', fontSize: ruang.personal ? 14 : 11 }} numberOfLines={1}>
          {ruang.personal ? 'P' : ruang.key}
        </Text>
      </Gradient>
      <Text variant="title" weight={700} style={{ flex: 1 }} numberOfLines={1}>
        {ruang.personal ? 'Pribadi' : ruang.name}
      </Text>
      <Text variant="meta">{jumlah} catatan</Text>
    </View>
  );
}

export function PanelPohon({
  ruang,
  tree,
  tertutup,
  onToggle,
  onBuka,
  onMenu,
  aktifId,
}: {
  ruang: RuangPanel;
  tree: PohonNode[];
  tertutup: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onBuka: (node: PohonNode) => void;
  onMenu?: (node: PohonNode) => void;
  aktifId?: string | null;
}): React.JSX.Element {
  const { colors } = useTheme();
  const baris = ratakan(tree, tertutup);
  return (
    <Card variant="flat" style={{ gap: 0 }}>
      <KepalaWorkspace ruang={ruang} jumlah={hitungCatatan(tree)} />
      {baris.length === 0 ? (
        <View style={s.kosong}>
          <Text variant="meta">Belum ada catatan di workspace ini.</Text>
        </View>
      ) : (
        baris.map(({ node, depth, jumlahAnak }, i) => {
          const folder = node.kind === 'folder';
          const terbuka = !tertutup.has(node.id);
          return (
            <View
              key={node.id}
              style={[s.baris, { paddingLeft: 8 + depth * 28 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }, aktifId === node.id && { backgroundColor: colors.linkSoft }]}
            >
              {folder && jumlahAnak > 0 ? (
                <Pressable onPress={() => onToggle(node.id)} accessibilityRole="button" accessibilityLabel={terbuka ? `Ciutkan ${node.title}` : `Buka ${node.title}`} hitSlop={6} scaleTo={1} style={s.panah}>
                  <Icon name={terbuka ? 'chevron-down' : 'chevron-right'} size={20} color={colors.muted} />
                </Pressable>
              ) : (
                <View style={s.panah} />
              )}
              <Pressable
                onPress={() => (folder && jumlahAnak > 0 ? onToggle(node.id) : onBuka(node))}
                scaleTo={1}
                accessibilityRole="button"
                accessibilityLabel={`${folder ? 'Folder' : 'Catatan'} ${node.title}${node.invited_only ? ', hanya diundang' : ''}${node.sinkron === 'menunggu' ? ', menunggu sinkron' : node.sinkron === 'gagal' ? ', gagal sinkron' : ''}`}
                style={s.isi}
              >
                <Icon name={ikonNode(node, terbuka)} size={24} color={node.preset === 'minutes' ? colors.primary : folder ? colors.accentBlue : colors.muted} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="title" numberOfLines={1} weight={folder ? 700 : 600}>
                    {node.title}
                  </Text>
                  <Text variant="meta" numberOfLines={1} style={{ fontSize: 14 }}>
                    {folder ? labelItem(jumlahAnak) : infoDiubah(node)}
                  </Text>
                  {node.sinkron ? <ChipMenunggu status={node.sinkron} /> : null}
                </View>
                {node.invited_only ? <Icon name="lock" size={16} color={colors.muted} /> : null}
                {node.my_role === 'view' && !folder ? (
                  <Badge tone="neutral" dot={false}>
                    Hanya baca
                  </Badge>
                ) : null}
              </Pressable>
              {onMenu ? (
                <Pressable onPress={() => onMenu(node)} accessibilityRole="button" accessibilityLabel={`Aksi untuk ${node.title}`} hitSlop={4} scaleTo={1} style={s.menu}>
                  <Icon name="ellipsis-vertical" size={20} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  lencana: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kosong: { paddingHorizontal: 16, paddingVertical: 20 },
  baris: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingRight: 4 },
  panah: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  isi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56 },
  menu: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
