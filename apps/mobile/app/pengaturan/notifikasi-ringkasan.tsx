/**
 * Contoh ringkasan hari ini — pratinjau email ringkasan harian (tidak
 * dikirim bila semua seksi kosong). Mockup: 21-ringkasan-harian-pratinjau.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ringkasanHarian, type PratinjauRingkasan } from '@/api/notifikasi';
import { tanggalPanjang } from '@/lib/format';
import { fontFamily, useTheme } from '@/theme';
import { Avatar, Badge, Card, EmptyState, ErrorState, Loading, Screen, SubAppBar, Text, errorKindFromStatus, type Tone } from '@/ui';

const NADA: Record<string, Tone> = { neutral: 'neutral', info: 'info', warning: 'warning', danger: 'danger', success: 'success' };

export default function LayarRingkasanHarian(): React.JSX.Element {
  const { colors } = useTheme();
  const [data, setData] = useState<PratinjauRingkasan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      setData(await ringkasanHarian());
    } catch (err) {
      setGalat({ pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat contoh ringkasan.', status: err instanceof ApiError ? err.status : 0 });
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  return (
    <Screen header={<SubAppBar title="Contoh ringkasan hari ini" />} onRefresh={() => void muat()}>
      {memuat && !data ? (
        <Loading rows={4} label="Menyusun contoh ringkasan…" />
      ) : galat ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : data ? (
        <>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {tanggalPanjang(data.digest.date)} · dikirim pukul {data.digest_time.replace(':', '.')} WIB
          </Text>
          {data.empty || data.digest.sections.length === 0 ? (
            <EmptyState
              icon="mail-check"
              title="Tidak ada yang perlu dikirim"
              description="Semua seksi kosong hari ini, jadi ringkasan tidak dikirim. Ringkasan hanya dikirim bila ada yang perlu Anda tindak lanjuti."
            />
          ) : (
            data.digest.sections.map((b) => (
              <Card key={b.key} variant="flat" style={{ gap: 10 }}>
                <View style={s.kepala}>
                  <Text variant="title" weight={700} style={{ flex: 1 }}>
                    {b.title}
                  </Text>
                  <Badge tone={NADA[b.tone] ?? 'neutral'} dot={false}>
                    {b.count}
                  </Badge>
                </View>
                {b.items.map((it, i) => (
                  <View key={`${it.title}-${i}`} style={[s.item, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                    {it.avatar_name ? <Avatar name={it.avatar_name} size="sm" /> : null}
                    <View style={{ flex: 1 }}>
                      <Text variant="body" style={{ fontSize: 16, lineHeight: 22 }}>
                        {it.code ? <Text variant="mono" style={{ fontFamily: fontFamily.mono600, fontSize: 14 }}>{`${it.code} · `}</Text> : null}
                        {it.title}
                      </Text>
                      {it.detail ? (
                        <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                          {it.detail}
                        </Text>
                      ) : null}
                    </View>
                    {it.badge ? (
                      <Badge tone={NADA[it.badge_tone] ?? 'neutral'} dot={false}>
                        {it.badge}
                      </Badge>
                    ) : it.trailing ? (
                      <Text variant="mono" style={{ fontFamily: fontFamily.mono500, fontSize: 14 }}>
                        {it.trailing}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {b.more ? (
                  <Text variant="meta" style={{ fontSize: 14 }}>
                    +{b.more} lainnya
                  </Text>
                ) : null}
                {b.note ? (
                  <Text variant="meta" style={{ fontSize: 14 }}>
                    {b.note}
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 },
});
