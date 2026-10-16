/**
 * Pesan baru (mockup 05 #2–#4): pilih rekan — satu = pesan langsung, dua atau
 * lebih = grup (maks. 8 rekan, 9 orang termasuk pembuat). DM/grup yang sama
 * dipakai ulang server (`direct_key`); hasilnya langsung dibuka.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { buatPercakapan, MAKS_REKAN, type OrangRingkas } from '@/api/obrolan';
import { PemilihOrang } from '@/features/obrolan/PemilihOrang';
import { bukaKanal, pesanGalat } from '@/features/obrolan/util';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, SubAppBar, Text, useSnackbar } from '@/ui';

export default function LayarPesanBaru(): React.JSX.Element {
  const snackbar = useSnackbar();
  const { user } = useSession();
  const saya = user?.id ?? null;
  const [terpilih, setTerpilih] = useState<OrangRingkas[]>([]);
  const [membuat, setMembuat] = useState(false);

  const buat = async (): Promise<void> => {
    if (terpilih.length === 0 || membuat) {
      return;
    }
    setMembuat(true);
    try {
      const hasil = await buatPercakapan(terpilih.map((o) => o.id));
      bukaKanal(hasil.channel, saya, true);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Obrolan gagal dibuat.'), variant: 'bad' });
      setMembuat(false);
    }
  };

  const grup = terpilih.length >= 2;
  const judulTombol = terpilih.length === 0 ? 'Pilih rekan' : grup ? `Buat grup · ${terpilih.length} rekan` : `Mulai pesan · ${terpilih[0]?.name.split(/\s+/)[0] ?? ''}`;

  return (
    <>
      <Stack.Screen options={{ animation: 'slide_from_right' }} />
      <Screen
        header={<SubAppBar title="Pesan baru" />}
        footer={
          <View style={{ flex: 1, gap: 8 }}>
            {grup ? (
              <Text variant="meta" align="center">
                Grup {terpilih.length + 1} orang (termasuk Anda). Dinamai otomatis dari nama anggota. Maks. {MAKS_REKAN + 1} orang.
              </Text>
            ) : null}
            <Button title={judulTombol} icon={grup ? 'users' : 'message-circle'} disabled={terpilih.length === 0} loading={membuat} loadingTitle="Membuka…" onPress={() => void buat()} />
          </View>
        }
      >
        <PemilihOrang terpilih={terpilih} onUbah={setTerpilih} maks={MAKS_REKAN} sembunyikan={saya ? [saya] : []} />
      </Screen>
    </>
  );
}
