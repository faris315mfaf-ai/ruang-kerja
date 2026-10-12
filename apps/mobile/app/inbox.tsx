/**
 * Layar Inbox (dibuka dari Lainnya) — feed notifikasi: saring Semua/Belum
 * dibaca, titik penanda belum dibaca, tekan menandai dibaca (unread global
 * ikut diperbarui).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { inbox, tandaiBaca } from '@/api/endpoints';
import type { InboxItem } from '@/api/types';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, Meta, Screen, Segmented } from '@/components/ui';
import { waktuRelatif } from '@/lib/format';
import { radius, useTheme } from '@/lib/theme';
import { useUnread } from '@/session/UnreadProvider';

type Saringan = 'semua' | 'belum';

function ikonInbox(ikon: string): keyof typeof Ionicons.glyphMap {
  const peta: Record<string, keyof typeof Ionicons.glyphMap> = {
    bell: 'notifications-outline',
    calendar: 'calendar-outline',
    'checkmark-circle': 'checkmark-circle-outline',
    'alert-circle': 'alert-circle-outline',
    people: 'people-outline',
    document: 'document-text-outline',
    briefcase: 'briefcase-outline',
    time: 'time-outline',
  };
  return peta[ikon] ?? 'notifications-outline';
}

function BarisInbox({ item, onTekan }: { item: InboxItem; onTekan: (item: InboxItem) => void }): React.JSX.Element {
  const { colors } = useTheme();
  const belum = item.read_at === null;

  return (
    <Card
      onPress={() => onTekan(item)}
      accessibilityLabel={`${belum ? 'Belum dibaca: ' : ''}${item.title}`}
      style={[gaya.kartu, belum && { borderColor: colors.primary, borderWidth: 1 }]}
    >
      <View style={gaya.kepala}>
        <View style={[gaya.ikon, { backgroundColor: belum ? colors.linkSoft : colors.surface2 }]}>
          <Ionicons name={ikonInbox(item.icon)} size={20} color={belum ? colors.link : colors.subtle} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[gaya.judul, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={gaya.metaBaris}>
            <Meta>{item.type_label}</Meta>
            {belum ? <View style={[gaya.titik, { backgroundColor: colors.badge }]} /> : null}
          </View>
        </View>
        <Meta>{waktuRelatif(item.created_at)}</Meta>
      </View>

      {item.body ? (
        <Text style={[gaya.isi, { color: colors.muted }]} numberOfLines={3}>
          {item.body}
        </Text>
      ) : null}

      {item.action_required ? <Badge tone="warning">Perlu tindakan</Badge> : null}
    </Card>
  );
}

export default function LayarInbox(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { perbarui } = useUnread();

  const [saringan, setSaringan] = useState<Saringan>('semua');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [halaman, setHalaman] = useState(1);
  const [halamanAkhir, setHalamanAkhir] = useState(1);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Request id: a slower response for an earlier filter must not override a newer one.
  const permintaan = useRef(0);

  const muat = useCallback(async (saring: Saringan, hal: number, tambah: boolean): Promise<void> => {
    const idMuat = ++permintaan.current;
    if (tambah) {
      setMemuatLagi(true);
    } else {
      setMemuat(true);
    }
    setGalat(null);
    try {
      const hasil = await inbox(hal, saring === 'belum');
      if (idMuat !== permintaan.current) {
        return;
      }
      setHalaman(hal); // only advance the page once it actually loaded
      setHalamanAkhir(hasil.meta.last_page);
      perbarui(hasil.unread);
      setItems((lama) => {
        if (!tambah) {
          return hasil.items;
        }
        const sudah = new Set(lama.map((satu) => satu.id));
        return [...lama, ...hasil.items.filter((satu) => !sudah.has(satu.id))];
      });
    } catch (err) {
      if (idMuat !== permintaan.current) {
        return;
      }
      setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat inbox.');
      if (!tambah) {
        setItems([]);
      }
    } finally {
      if (idMuat === permintaan.current) {
        setMemuat(false);
        setMemuatLagi(false);
      }
    }
  }, [perbarui]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat saringan berubah
    void muat(saringan, 1, false);
  }, [saringan, muat]);

  const tandai = useCallback(
    async (item: InboxItem) => {
      if (item.read_at !== null) {
        return;
      }
      setItems((lama) =>
        saringan === 'belum'
          ? lama.filter((satu) => satu.id !== item.id)
          : lama.map((satu) => (satu.id === item.id ? { ...satu, read_at: new Date().toISOString() } : satu)),
      );
      try {
        perbarui(await tandaiBaca(item.id));
      } catch {
        // Ditandai lokal; lencana disinkronkan saat dimuat ulang.
      }
    },
    [perbarui, saringan],
  );

  const masihAda = halaman < halamanAkhir;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[gaya.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[gaya.judulLayar, { color: colors.text }]}>Inbox</Text>
      </Pressable>
      <Screen>
        <Segmented<Saringan>
        value={saringan}
        onChange={(nilai) => {
          setSaringan(nilai);
        }}
        options={[
          { value: 'semua', label: 'Semua' },
          { value: 'belum', label: 'Belum dibaca' },
        ]}
      />

      {memuat ? (
        <Loading label="Memuat inbox…" />
      ) : galat && items.length === 0 ? (
        <ErrorState message={galat} onRetry={() => void muat(saringan, 1, false)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title={saringan === 'belum' ? 'Tidak ada yang belum dibaca' : 'Inbox kosong'}
          description="Notifikasi baru akan muncul di sini."
        />
      ) : (
        <>
          {galat ? <Meta>{galat}</Meta> : null}
          <View style={{ gap: 10 }}>
            {items.map((item) => (
              <BarisInbox key={item.id} item={item} onTekan={(i) => void tandai(i)} />
            ))}
          </View>

          {masihAda ? (
            <Button
              title={memuatLagi ? 'Memuat…' : 'Muat lagi'}
              variant="secondary"
              icon="chevron-down"
              disabled={memuatLagi}
              loading={memuatLagi}
              onPress={() => {
                void muat(saringan, halaman + 1, true);
              }}
            />
          ) : (
            <Meta style={{ textAlign: 'center' }}>Itu saja untuk sekarang</Meta>
          )}
        </>
      )}
      </Screen>
    </View>
  );
}

const gaya = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulLayar: { fontSize: 18, fontWeight: '800' },
  kartu: { padding: 14 },
  kepala: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ikon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  metaBaris: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titik: { width: 8, height: 8, borderRadius: 4 },
  isi: { fontSize: 14, lineHeight: 20 },
});
