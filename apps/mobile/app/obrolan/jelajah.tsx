/**
 * Jelajahi kanal publik (mockup 06): "Belum bergabung" dengan tombol Lihat
 * (pratinjau baca-saja, bergabung lewat banner di kanal) dan "Sudah bergabung".
 * Berhalaman 30, pencarian nama/topik di server.
 */
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { jelajahKanalPublik, type Halaman, type KanalPublik } from '@/api/obrolan';
import { UbinKanal } from '@/features/obrolan/UbinKanal';
import { useTheme } from '@/theme';
import { Badge, Button, Card, EmptyState, ErrorState, errorKindFromStatus, Loading, Pressable, Screen, SearchInput, SubAppBar, Text } from '@/ui';

interface Hasil {
  q: string;
  kanal: KanalPublik[];
  meta: Halaman | null;
  galat: { status: number; pesan: string } | null;
}

function Baris({ k, divider }: { k: KanalPublik; divider: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const buka = (): void => router.push({ pathname: '/obrolan/[id]', params: { id: k.id, nama: k.title, jenis: 'public' } });
  return (
    <Pressable
      onPress={buka}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={`${k.title}, ${k.members_count} anggota${k.is_member ? ', sudah bergabung' : ', belum bergabung'}`}
      style={[s.baris, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
    >
      <UbinKanal jenis="public" nama={k.title} />
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {k.name}
        </Text>
        <Text variant="meta" numberOfLines={1} style={{ fontSize: 14 }}>
          {k.members_count} anggota{k.topic ? ` · ${k.topic}` : ''}
        </Text>
      </View>
      {k.is_member ? (
        <Badge tone="success">Bergabung</Badge>
      ) : (
        <View style={[s.lihat, { backgroundColor: colors.linkSoft }]}>
          <Text variant="label" weight={700} tone="link">
            Lihat
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function LayarJelajah(): React.JSX.Element {
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [memuatLagi, setMemuatLagi] = useState(false);

  useEffect(() => {
    let batal = false;
    const pewaktu = setTimeout(
      () => {
        jelajahKanalPublik(q, 1)
          .then((r) => {
            if (!batal) {
              setHasil({ q, kanal: r.channels, meta: r.meta, galat: null });
            }
          })
          .catch((err: unknown) => {
            if (!batal) {
              setHasil({ q, kanal: [], meta: null, galat: { status: err instanceof ApiError ? err.status : -1, pesan: err instanceof ApiError ? err.message : 'Kanal tidak dapat dimuat.' } });
            }
          });
      },
      q === '' ? 0 : 300,
    );
    return () => {
      batal = true;
      clearTimeout(pewaktu);
    };
  }, [q, percobaan]);

  const memuat = hasil === null || hasil.q !== q;

  const lagi = async (): Promise<void> => {
    if (!hasil?.meta?.has_more || memuatLagi) {
      return;
    }
    setMemuatLagi(true);
    try {
      const r = await jelajahKanalPublik(q, hasil.meta.page + 1);
      setHasil({ q, kanal: [...hasil.kanal, ...r.channels], meta: r.meta, galat: null });
    } catch {
      // Tombol tetap ada; pengguna bisa mencoba lagi.
    } finally {
      setMemuatLagi(false);
    }
  };

  const belum = (hasil?.kanal ?? []).filter((k) => !k.is_member);
  const sudah = (hasil?.kanal ?? []).filter((k) => k.is_member);

  return (
    <>
      <Stack.Screen options={{ animation: 'slide_from_right' }} />
      <Screen header={<SubAppBar title="Jelajahi kanal publik" />}>
        <SearchInput value={q} onChangeText={setQ} placeholder="Cari kanal publik" />
        {memuat ? (
          <Loading rows={4} />
        ) : hasil?.galat ? (
          <ErrorState message={hasil.galat.pesan} kind={errorKindFromStatus(hasil.galat.status === -1 ? undefined : hasil.galat.status)} onRetry={() => setPercobaan((n) => n + 1)} />
        ) : (hasil?.kanal.length ?? 0) === 0 ? (
          <EmptyState icon="compass" title="Tidak ada kanal publik" description={q === '' ? 'Belum ada kanal publik yang bisa diikuti.' : `Tidak ada kanal yang cocok dengan “${q}”.`} />
        ) : (
          <>
            {belum.length > 0 ? (
              <View style={{ gap: 8 }}>
                <View style={s.seksi}>
                  <Text variant="overline" tone="muted">
                    Belum bergabung
                  </Text>
                  <Text variant="meta">{belum.length}</Text>
                </View>
                <Card variant="flat">
                  {belum.map((k, i) => (
                    <Baris key={k.id} k={k} divider={i > 0} />
                  ))}
                </Card>
              </View>
            ) : null}
            {sudah.length > 0 ? (
              <View style={{ gap: 8 }}>
                <View style={s.seksi}>
                  <Text variant="overline" tone="muted">
                    Sudah bergabung
                  </Text>
                  <Text variant="meta">{sudah.length}</Text>
                </View>
                <Card variant="flat">
                  {sudah.map((k, i) => (
                    <Baris key={k.id} k={k} divider={i > 0} />
                  ))}
                </Card>
              </View>
            ) : null}
            {hasil?.meta?.has_more ? <Button title="Muat lebih banyak" variant="outline" loading={memuatLagi} onPress={() => void lagi()} /> : null}
            <Text variant="meta">Anda bisa membaca kanal publik tanpa bergabung. Mengirim pesan pertama otomatis menggabungkan Anda.</Text>
          </>
        )}
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 16, paddingVertical: 10 },
  lihat: { minHeight: 40, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seksi: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
});
