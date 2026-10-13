/**
 * Matriks kejadian × kanal sebagai accordion per kategori (mockup 18/19).
 * Baris terkunci menampilkan "Selalu aktif" + saklar redup; WhatsApp
 * "Segera hadir" (mati).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BarisMatriks, KanalNotifikasi, PengaturanNotifikasi } from '@/api/notifikasi';
import { useTheme } from '@/theme';
import { Badge, Icon, Pressable, Switch, Text, type AnyIconName } from '@/ui';

const IKON_KANAL: Record<KanalNotifikasi, AnyIconName> = { in_app: 'bell', email: 'mail', whatsapp: 'message-circle' };
const URUTAN: KanalNotifikasi[] = ['in_app', 'email', 'whatsapp'];

function ringkas(baris: BarisMatriks, label: (k: KanalNotifikasi) => string): string {
  const aktif = URUTAN.filter((k) => baris.channels[k]?.enabled).map(label);
  const kunci = URUTAN.some((k) => baris.channels[k]?.enabled && !baris.channels[k]?.configurable);
  const isi = aktif.length > 0 ? aktif.join(', ') : 'Mati';
  return kunci ? `${isi} · terkunci` : isi;
}

function BarisEvent({
  baris,
  label,
  terbuka,
  onBuka,
  onUbah,
  baca,
}: {
  baris: BarisMatriks;
  label: (k: KanalNotifikasi) => string;
  terbuka: boolean;
  onBuka: () => void;
  onUbah: (kanal: KanalNotifikasi, aktif: boolean) => void;
  baca: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const ringkasan = ringkas(baris, label);
  return (
    <View>
      <Pressable
        scaleTo={1}
        onPress={onBuka}
        accessibilityRole="button"
        accessibilityLabel={`${baris.label}. ${ringkasan}`}
        accessibilityState={{ expanded: terbuka }}
        style={[s.kepala, terbuka ? { backgroundColor: colors.surface2 } : null]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" weight={600} style={{ fontSize: 16, lineHeight: 22 }}>
            {baris.label}
          </Text>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            {ringkasan}
          </Text>
        </View>
        <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
      </Pressable>
      {terbuka ? (
        <View style={[s.isi, { backgroundColor: colors.surface2 }]}>
          <View style={[s.kanalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {URUTAN.map((k, i) => {
              const sel = baris.channels[k];
              if (!sel) {
                return null;
              }
              const segera = !sel.supported || (k === 'whatsapp' && !sel.configurable);
              const terkunci = !sel.configurable && !segera;
              return (
                <View key={k} style={[s.kanal, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                  <Icon name={IKON_KANAL[k]} size={22} color={colors.muted} />
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text variant="body" style={{ fontSize: 16 }}>
                      {label(k)}
                    </Text>
                    {terkunci ? (
                      <View style={[s.pil, { backgroundColor: colors.surface2 }]}>
                        <Icon name="lock" size={12} color={colors.muted} />
                        <Text variant="meta" weight={700} style={{ fontSize: 12 }}>
                          Selalu aktif
                        </Text>
                      </View>
                    ) : null}
                    {segera ? (
                      <Badge tone="info" dot={false}>
                        Segera hadir
                      </Badge>
                    ) : null}
                  </View>
                  <Switch
                    value={sel.enabled}
                    onValueChange={(v) => onUbah(k, v)}
                    disabled={terkunci || segera || baca}
                    label={`${label(k)} untuk ${baris.label}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function MatriksNotifikasi({
  data,
  onUbah,
  baca,
}: {
  data: PengaturanNotifikasi;
  onUbah: (event: string, kanal: KanalNotifikasi, aktif: boolean) => void;
  baca: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [buka, setBuka] = useState<string | null>(null);
  const label = (k: KanalNotifikasi): string => data.channels.find((c) => c.value === k)?.label ?? k;
  return (
    <View style={{ gap: 20 }}>
      {data.categories.map((kat) => {
        const baris = data.matrix.filter((b) => b.category === kat.value);
        if (baris.length === 0) {
          return null;
        }
        return (
          <View key={kat.value} style={{ gap: 8 }}>
            <Text variant="overline" tone="muted" accessibilityRole="header">
              {kat.label}
            </Text>
            <View style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {baris.map((b, i) => (
                <View key={b.event} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
                  <BarisEvent
                    baris={b}
                    label={label}
                    terbuka={buka === b.event}
                    onBuka={() => setBuka(buka === b.event ? null : b.event)}
                    onUbah={(k, v) => onUbah(b.event, k, v)}
                    baca={baca}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kartu: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  isi: { paddingHorizontal: 12, paddingBottom: 12 },
  kanalBox: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  kanal: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
