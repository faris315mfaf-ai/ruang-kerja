/**
 * Pemilih orang (mockup 05): kolom cari, chip pilihan, daftar berkotak centang.
 * Sumber: `GET /orang?q=` (B2-B; cakupan mengikuti hak lihat pengguna di server).
 * Batas `maks` rekan; melewatinya menampilkan pesan, bukan menambah.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { cariOrang, type OrangRingkas } from '@/api/obrolan';
import { useTheme } from '@/theme';
import { Avatar, Chip, EmptyState, ErrorState, errorKindFromStatus, Gradient, Icon, Loading, Pressable, SearchInput, Text, toneColor } from '@/ui';

interface Hasil {
  q: string;
  orang: OrangRingkas[];
  galat: { status: number; pesan: string } | null;
}

export function PemilihOrang({
  terpilih,
  onUbah,
  maks,
  placeholder = 'Cari nama rekan',
  sembunyikan = [],
}: {
  terpilih: OrangRingkas[];
  onUbah: (daftar: OrangRingkas[]) => void;
  maks: number;
  placeholder?: string;
  /** Id yang tidak ditampilkan (mis. diri sendiri). */
  sembunyikan?: string[];
}): React.JSX.Element {
  const { colors } = useTheme();
  const putih = toneColor(colors, 'onPrimary');
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    let batal = false;
    const pewaktu = setTimeout(
      () => {
        cariOrang(q)
          .then((r) => {
            if (!batal) {
              setHasil({ q, orang: r.orang, galat: null });
            }
          })
          .catch((err: unknown) => {
            if (!batal) {
              setHasil({
                q,
                orang: [],
                galat: {
                  status: err instanceof ApiError ? err.status : -1,
                  pesan: err instanceof ApiError ? (err.status === 404 ? 'Pemilih orang belum tersedia di server ini.' : err.message) : 'Daftar orang tidak dapat dimuat.',
                },
              });
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
  const ids = new Set(terpilih.map((o) => o.id));
  const penuh = terpilih.length >= maks;
  const tampil = (hasil?.orang ?? []).filter((o) => !sembunyikan.includes(o.id));

  const ubah = (orang: OrangRingkas, nyala: boolean): void => {
    if (nyala) {
      if (!ids.has(orang.id) && terpilih.length < maks) {
        onUbah([...terpilih, orang]);
      }
    } else {
      onUbah(terpilih.filter((o) => o.id !== orang.id));
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <SearchInput value={q} onChangeText={setQ} placeholder={placeholder} />

      {terpilih.length > 0 ? (
        <View style={s.chipBaris} accessibilityLabel={`${terpilih.length} rekan dipilih`}>
          {terpilih.map((o) => (
            <Chip key={o.id} label={o.name.split(/\s+/)[0] ?? o.name} variant="tonal" selected onDismiss={() => ubah(o, false)} />
          ))}
        </View>
      ) : null}

      {penuh ? (
        <Text variant="meta" tone="warning" accessibilityLiveRegion="polite">
          Maksimal {maks} rekan ({maks + 1} orang termasuk Anda). Untuk tim lebih besar, buat kanal.
        </Text>
      ) : null}

      {memuat ? (
        <Loading rows={4} />
      ) : hasil?.galat ? (
        <ErrorState message={hasil.galat.pesan} kind={errorKindFromStatus(hasil.galat.status === -1 ? undefined : hasil.galat.status)} onRetry={() => setPercobaan((n) => n + 1)} />
      ) : tampil.length === 0 ? (
        <EmptyState icon="search" title="Tidak ada hasil" description={q === '' ? 'Belum ada rekan yang bisa dipilih.' : `Tidak ada rekan bernama “${q}”.`} variant="plain" />
      ) : (
        tampil.map((o) => {
          const nyala = ids.has(o.id);
          return (
            <Pressable
              key={o.id}
              onPress={() => ubah(o, !nyala)}
              disabled={!nyala && penuh}
              scaleTo={1}
              accessibilityRole="checkbox"
              accessibilityLabel={`${o.name}${o.position ? `, ${o.position}` : ''}`}
              accessibilityState={{ checked: nyala, disabled: !nyala && penuh }}
              style={[s.baris, { borderColor: colors.divider, opacity: !nyala && penuh ? 0.5 : 1 }]}
            >
              <View style={[s.kotak, { borderColor: nyala ? 'transparent' : colors.borderStrong }]}>
                {nyala ? (
                  <>
                    <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 5 }]} />
                    <Icon name="check" size={16} color={putih} strokeWidth={2.6} />
                  </>
                ) : null}
              </View>
              <Avatar name={o.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={1}>
                  {o.name}
                </Text>
                {o.position || o.division ? (
                  <Text variant="meta" numberOfLines={1}>
                    {[o.position, o.division].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  chipBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth },
  kotak: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
