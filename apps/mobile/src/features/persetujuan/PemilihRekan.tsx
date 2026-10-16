/** Sheet "Pilih rekan" untuk delegasi (mockup 23 p3): cari `GET /orang?q=`, centang terpilih. */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { cariRekan, type OrangPilihan } from '@/api/persetujuan';
import { radius, useTheme } from '@/theme';
import { Avatar, BottomSheet, Icon, Loading, Pressable, SearchInput, Text } from '@/ui';

export function PemilihRekan({
  visible,
  terpilihId,
  kecualikan,
  onPilih,
  onClose,
}: {
  visible: boolean;
  terpilihId: string | null;
  /** Id yang tidak ditampilkan (diri sendiri, atasan langsung). */
  kecualikan: string[];
  onPilih: (orang: OrangPilihan) => void;
  onClose: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<OrangPilihan[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const nomor = useRef(0);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const n = ++nomor.current;
    const t = setTimeout(
      () => {
        setMemuat(true);
        setGalat(null);
        cariRekan(q)
          .then((orang) => {
            if (n === nomor.current) {
              setHasil(orang);
            }
          })
          .catch((err: unknown) => {
            if (n === nomor.current) {
              setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat rekan.');
            }
          })
          .finally(() => {
            if (n === nomor.current) {
              setMemuat(false);
            }
          });
      },
      q === '' ? 0 : 300,
    );
    return () => clearTimeout(t);
  }, [q, visible]);

  const daftar = hasil.filter((o) => !kecualikan.includes(o.id));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih rekan" scrollable>
      <SearchInput value={q} onChangeText={setQ} placeholder="Cari nama" />
      {memuat && daftar.length === 0 ? <Loading rows={3} label="Mencari rekan…" /> : null}
      {galat ? (
        <Text variant="meta" tone="danger" accessibilityRole="alert">
          {galat}
        </Text>
      ) : null}
      {!memuat && !galat && daftar.length === 0 ? (
        <Text variant="body" tone="muted" align="center" style={{ paddingVertical: 16 }}>
          {q.trim() === '' ? 'Ketik nama rekan.' : `Tidak ada rekan bernama “${q.trim()}”.`}
        </Text>
      ) : null}
      <View>
        {daftar.map((o) => {
          const pilih = o.id === terpilihId;
          return (
            <Pressable
              key={o.id}
              onPress={() => onPilih(o)}
              scaleTo={1}
              accessibilityRole="radio"
              accessibilityState={{ selected: pilih }}
              accessibilityLabel={[o.name, o.position, o.division].filter(Boolean).join(', ')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                minHeight: 64,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: radius.lg,
                backgroundColor: pilih ? colors.linkSoft : 'transparent',
              }}
            >
              <Avatar name={o.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={1}>
                  {o.name}
                </Text>
                {o.position || o.division ? (
                  <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
                    {[o.position, o.division].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {pilih ? <Icon name="circle-check" size={24} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text variant="meta" style={{ fontSize: 14 }}>
        Pilih rekan aktif yang akan memutuskan atas nama Anda. Atasan Anda tidak ditampilkan.
      </Text>
    </BottomSheet>
  );
}
