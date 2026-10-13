/** Hasil pencarian catatan lintas workspace (mockup 03) dengan chip workspace berhitung. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { cariCatatan, type PencarianCatatan } from '@/api/catatan';
import { waktuRelatif } from '@/lib/format';
import { useTheme } from '@/theme';
import { Card, Chip, ChipScroller, EmptyState, ErrorState, Icon, Loading, Pressable, Text, errorKindFromStatus } from '@/ui';

/** Judul dengan kata kunci disorot. */
function Sorot({ teks, q }: { teks: string; q: string }): React.JSX.Element {
  const { colors } = useTheme();
  const kunci = q.trim();
  if (kunci === '') {
    return <>{teks}</>;
  }
  const bagian: React.ReactNode[] = [];
  const kecil = teks.toLowerCase();
  const cari = kunci.toLowerCase();
  let dari = 0;
  for (let i = 0; ; i++) {
    const idx = kecil.indexOf(cari, dari);
    if (idx < 0) {
      bagian.push(teks.slice(dari));
      break;
    }
    bagian.push(teks.slice(dari, idx));
    bagian.push(
      <Text key={i} weight={800} style={{ color: colors.link, backgroundColor: colors.linkSoft }}>
        {teks.slice(idx, idx + cari.length)}
      </Text>,
    );
    dari = idx + cari.length;
  }
  return <>{bagian}</>;
}

export function HasilCari({ q, workspaceId, onHapus }: { q: string; workspaceId?: string | null; onHapus: () => void }): React.JSX.Element | null {
  const { colors } = useTheme();
  const [tertib, setTertib] = useState<string | null>(null);
  const [hasil, setHasil] = useState<PencarianCatatan | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [coba, setCoba] = useState(0);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const kunci = q.trim();
  const sah = kunci.length >= 2;

  useEffect(() => {
    if (!sah) {
      return undefined;
    }
    let batal = false;
    const timer = setTimeout(() => {
      setMemuat(true);
      setGalat(null);
      cariCatatan(kunci, tertib ?? workspaceId ?? null)
        .then((r) => {
          if (!batal) {
            setHasil(r);
          }
        })
        .catch((err: unknown) => {
          if (!batal) {
            setGalat({ pesan: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Pencarian gagal.', status: err instanceof ApiError ? err.status : 500 });
          }
        })
        .finally(() => {
          if (!batal) {
            setMemuat(false);
          }
        });
    }, 350);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [kunci, sah, tertib, workspaceId, coba]);

  if (!sah) {
    return (
      <Text variant="meta" style={{ paddingHorizontal: 4 }}>
        Ketik minimal 2 karakter untuk mencari judul atau isi catatan.
      </Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {hasil && hasil.workspaces.length > 1 ? (
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label="Semua" selected={tertib === null} count={hasil.total} onPress={() => setTertib(null)} />
          {hasil.workspaces.map((w) => (
            <Chip key={w.id} label={w.key === 'PRIBADI' ? 'Pribadi' : w.key} selected={tertib === w.id} count={w.count} onPress={() => setTertib(w.id)} />
          ))}
        </ChipScroller>
      ) : null}

      {galat ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => setCoba((c) => c + 1)} />
      ) : memuat && !hasil ? (
        <Loading label="Mencari…" rows={3} />
      ) : hasil && hasil.results.length === 0 ? (
        <EmptyState icon="search-x" title="Tidak ada catatan yang cocok" description={`Tidak ada judul atau isi yang memuat “${kunci}”.`} actionLabel="Hapus pencarian" onAction={onHapus} />
      ) : hasil ? (
        <Card variant="flat" style={{ gap: 0, opacity: memuat ? 0.6 : 1 }}>
          {hasil.results.map((r, i) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/catatan/${r.id}`)}
              scaleTo={1}
              accessibilityRole="button"
              accessibilityLabel={`Catatan ${r.title}`}
              style={[s.baris, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}
            >
              <Icon name={r.preset === 'minutes' ? 'notebook-pen' : r.kind === 'folder' ? 'folder' : 'file-text'} size={24} color={r.preset === 'minutes' ? colors.primary : colors.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" weight={700} numberOfLines={2}>
                  <Sorot teks={r.title} q={kunci} />
                </Text>
                {r.snippet ? (
                  <Text variant="meta" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
                    <Sorot teks={r.snippet} q={kunci} />
                  </Text>
                ) : null}
                <Text variant="meta" numberOfLines={1} style={{ fontSize: 13 }}>
                  {r.workspace_name}
                  {r.updated_at ? ` · ${waktuRelatif(r.updated_at)}` : ''}
                </Text>
              </View>
              {r.invited_only ? <Icon name="lock" size={16} color={colors.muted} /> : null}
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 },
});
