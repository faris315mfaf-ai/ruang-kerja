/**
 * Tab Obrolan — daftar kanal (ChatInbox web): nama, pratinjau pesan
 * terakhir, waktu, lencana belum-dibaca; saringan Semua/Belum-dibaca.
 * Di balik flag features.chat: 404 dari server → layar kosong ramah
 * "Obrolan belum diaktifkan", bukan galat.
 */
import { Ionicons } from '@/ui/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarKanal } from '@/api/endpoints';
import type { ChannelType, ChatChannel } from '@/api/types';
import { Card, EmptyState, ErrorState, Loading, Meta, Screen, Segmented } from '@/components/ui';
import { waktuRelatif } from '@/lib/format';
import { radius, useTheme } from '@/lib/theme';

type Saringan = 'semua' | 'belum';

const IKON_KANAL: Record<ChannelType, keyof typeof Ionicons.glyphMap> = {
  workspace: 'grid-outline',
  public: 'globe-outline',
  private: 'lock-closed-outline',
  dm: 'person-outline',
  group: 'people-outline',
};

const LABEL_JENIS: Record<ChannelType, string> = {
  workspace: 'Workspace',
  public: 'Kanal publik',
  private: 'Kanal privat',
  dm: 'Pesan langsung',
  group: 'Grup',
};

/** Nama tampilan kanal — kontrak tidak membawa nama anggota DM/grup. */
function namaKanal(kanal: ChatChannel): string {
  if (kanal.name && kanal.name.trim() !== '') {
    return kanal.name;
  }
  if (kanal.type === 'workspace' && kanal.workspace) {
    return kanal.workspace.name;
  }
  const jumlah = kanal.members.length;
  const akhiran = jumlah > 0 ? ` · ${jumlah} orang` : '';
  return `${LABEL_JENIS[kanal.type]}${akhiran}`;
}

function BarisKanal({ kanal, onTekan }: { kanal: ChatChannel; onTekan: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const belum = kanal.unread_count > 0;
  const pratinjau = kanal.last_message
    ? kanal.last_message.deleted || kanal.last_message.body_text === ''
      ? 'Pesan dihapus'
      : kanal.last_message.body_text
    : 'Belum ada pesan';

  return (
    <Card
      onPress={onTekan}
      accessibilityLabel={`${namaKanal(kanal)}${belum ? `, ${kanal.unread_count} belum dibaca` : ''}`}
      style={[gaya.kartu, belum && { borderColor: colors.primary, borderWidth: 1 }]}
    >
      <View style={gaya.kepala}>
        <View style={[gaya.ikon, { backgroundColor: belum ? colors.linkSoft : colors.surface2 }]}>
          <Ionicons name={IKON_KANAL[kanal.type]} size={18} color={belum ? colors.link : colors.subtle} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[gaya.judul, { color: colors.text }]} numberOfLines={1}>
            {namaKanal(kanal)}
          </Text>
          <View style={gaya.metaBaris}>
            <Meta>{LABEL_JENIS[kanal.type]}</Meta>
            {kanal.archived_at ? <Meta>· diarsipkan</Meta> : null}
          </View>
        </View>
        {belum ? (
          <View style={[gaya.lencana, { backgroundColor: colors.badge }]}>
            <Text style={[gaya.lencanaTeks, { color: colors.onBadge }]}>
              {kanal.unread_count > 99 ? '99+' : kanal.unread_count}
            </Text>
          </View>
        ) : (
          <Meta>{waktuRelatif(kanal.last_message?.created_at ?? null)}</Meta>
        )}
      </View>
      <Text style={[gaya.pratinjau, { color: belum ? colors.text : colors.muted }]} numberOfLines={2}>
        {pratinjau}
      </Text>
    </Card>
  );
}

export default function LayarObrolan(): React.JSX.Element {
  const { colors } = useTheme();

  const [saringan, setSaringan] = useState<Saringan>('semua');
  const [kanal, setKanal] = useState<ChatChannel[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [mati, setMati] = useState(false);

  const muat = useCallback(async (diam = false): Promise<void> => {
    if (!diam) {
      setMemuat(true);
    }
    setGalat(null);
    try {
      const hasil = await daftarKanal();
      setKanal(hasil.channels);
      setMati(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Flag features.chat mati di server — bukan galat aplikasi.
        setMati(true);
        setKanal([]);
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat obrolan.');
      }
    } finally {
      setMemuat(false);
      setMenyegarkan(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const belumSemua = kanal.filter((satu) => satu.unread_count > 0);
  const tampil = saringan === 'belum' ? belumSemua : kanal;

  if (mati) {
    return (
      <Screen>
        <Text style={[gaya.judulLayar, { color: colors.text }]}>Obrolan</Text>
        <EmptyState
          icon="cloud-offline-outline"
          title="Obrolan belum diaktifkan"
          description="Fitur obrolan sedang tidak tersedia di server. Silakan gunakan RuangKerja web atau hubungi admin."
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={menyegarkan}
      onRefresh={() => {
        setMenyegarkan(true);
        void muat(true);
      }}
    >
      <Text style={[gaya.judulLayar, { color: colors.text }]}>Obrolan</Text>
      <Segmented<Saringan>
        value={saringan}
        onChange={setSaringan}
        options={[
          { value: 'semua', label: 'Semua', badge: kanal.length > 0 ? kanal.length : null },
          { value: 'belum', label: 'Belum dibaca', badge: belumSemua.length > 0 ? belumSemua.length : null },
        ]}
      />

      {memuat && kanal.length === 0 ? (
        <Loading label="Memuat kanal…" />
      ) : galat && kanal.length === 0 ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : tampil.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={saringan === 'belum' ? 'Tidak ada pesan baru' : 'Belum ada kanal'}
          description={
            saringan === 'belum'
              ? 'Semua pesan sudah Anda baca.'
              : 'Kanal workspace dan pesan langsung akan muncul di sini.'
          }
        />
      ) : (
        <>
          {galat ? <Meta>{galat}</Meta> : null}
          <View style={{ gap: 10 }}>
            {tampil.map((satu) => (
              <BarisKanal
                key={satu.id}
                kanal={satu}
                onTekan={() =>
                  router.push({
                    pathname: '/obrolan/[id]',
                    params: {
                      id: satu.id,
                      nama: namaKanal(satu),
                      jenis: satu.type,
                      bolehKirim: satu.can_post ? '1' : '0',
                    },
                  })
                }
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const gaya = StyleSheet.create({
  judulLayar: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  kartu: { padding: 14 },
  kepala: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ikon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 15, fontWeight: '700' },
  metaBaris: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pratinjau: { fontSize: 14, lineHeight: 20 },
  lencana: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lencanaTeks: { fontSize: 12, fontWeight: '700' },
});
