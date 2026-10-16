/**
 * Spanduk pengumuman di atas Beranda/dashboard (spec 02, `09-pengumuman`):
 * maks. 3 terbaru yang ditujukan ke saya dan belum ditutup. × (44 px) menutup
 * untuk diri sendiri — optimistis, rollback + snackbar bila gagal. Ketuk isi
 * → sheet baca penuh. "Lihat semua pengumuman (N)" → daftar (modul 10).
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { tutupPengumuman, type Pengumuman, type Spanduk } from '@/api/beranda';
import { waktuRelatif } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, IconButton, IconTile, Pressable, Text, useSnackbar } from '@/ui';

import { bukaDaftarPengumuman } from './nav';

/** Keadaan lokal spanduk: item yang ditutup disembunyikan seketika, rollback bila gagal. */
export function useSpanduk(sumber: Spanduk | null): { items: Pengumuman[]; total: number; tutup: (id: string) => void } {
  const snackbar = useSnackbar();
  const [disembunyi, setDisembunyi] = useState<readonly string[]>([]);

  const tutup = useCallback(
    (id: string): void => {
      setDisembunyi((lama) => [...lama, id]);
      tutupPengumuman(id).catch(() => {
        setDisembunyi((lama) => lama.filter((x) => x !== id));
        snackbar.show({ message: 'Pengumuman gagal ditutup. Coba lagi.', variant: 'bad' });
      });
    },
    [snackbar],
  );

  return useMemo(() => {
    const semua = sumber?.items ?? [];
    const items = semua.filter((p) => !disembunyi.includes(p.id));
    const tersembunyi = semua.length - items.length;
    return { items, total: Math.max(0, (sumber?.total ?? 0) - tersembunyi), tutup };
  }, [sumber, disembunyi, tutup]);
}

function baris(p: Pengumuman): string {
  return [p.author?.name, p.audience_label, waktuRelatif(p.published_at)].filter((x): x is string => !!x).join(' · ');
}

export function SpandukPengumuman({ spanduk }: { spanduk: Spanduk | null }): React.JSX.Element | null {
  const { colors } = useTheme();
  const { items, total, tutup } = useSpanduk(spanduk);
  const [baca, setBaca] = useState<Pengumuman | null>(null);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 10 }}>
      {items.map((p) => (
        <View
          key={p.id}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            backgroundColor: colors.infoSoft,
            borderRadius: radius.cardTight,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 12,
            paddingLeft: 12,
            paddingRight: 4,
          }}
        >
          <Pressable
            onPress={() => setBaca(p)}
            scaleTo={0.99}
            accessibilityRole="button"
            accessibilityLabel={`Pengumuman: ${p.title}. Ketuk untuk membaca selengkapnya`}
            style={{ flex: 1, flexDirection: 'row', gap: 10 }}
          >
            <IconTile icon="megaphone" tone="blue" size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title" numberOfLines={2}>
                {p.title}
              </Text>
              <Text variant="body" numberOfLines={2} style={{ fontSize: 15, lineHeight: 21 }}>
                {p.body}
              </Text>
              <Text variant="meta" numberOfLines={1}>
                {baris(p)}
              </Text>
            </View>
          </Pressable>
          <IconButton icon="x" label={`Tutup pengumuman ${p.title}`} variant="ghost" size={44} onPress={() => tutup(p.id)} />
        </View>
      ))}
      {total > 1 ? (
        <Pressable
          onPress={bukaDaftarPengumuman}
          scaleTo={1}
          accessibilityRole="link"
          accessibilityLabel={`Lihat semua pengumuman, ${total}`}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text variant="label" tone="link">{`Lihat semua pengumuman (${total})`}</Text>
        </Pressable>
      ) : null}

      <BottomSheet visible={baca !== null} onClose={() => setBaca(null)} title={baca?.title} scrollable>
        {baca ? (
          <>
            <Text variant="meta">{baris(baca)}</Text>
            <Text variant="body">{baca.body}</Text>
            <Button title="Tutup" variant="outline" onPress={() => setBaca(null)} />
          </>
        ) : null}
      </BottomSheet>
    </View>
  );
}
