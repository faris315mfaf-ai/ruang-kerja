/**
 * Kanal baru (mockup 05 #5–#6): nama (dinormalisasi jadi slug oleh server),
 * topik, kanal privat, undang anggota (opsional). Galat per kolom; fokus
 * berpindah ke kolom nama bila tidak valid.
 */
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatKanalBaru, type OrangRingkas } from '@/api/obrolan';
import { PemilihOrang } from '@/features/obrolan/PemilihOrang';
import { bukaKanal, pesanGalat, slugKanal } from '@/features/obrolan/util';
import { useSession } from '@/session/SessionProvider';
import { BottomSheet, Button, Chip, Field, Input, Screen, SubAppBar, Switch, Text, useSnackbar } from '@/ui';

const MAKS_ANGGOTA_UNDANG = 50;

export default function LayarKanalBaru(): React.JSX.Element {
  const snackbar = useSnackbar();
  const { user } = useSession();
  const saya = user?.id ?? null;
  const [nama, setNama] = useState('');
  const [topik, setTopik] = useState('');
  const [privat, setPrivat] = useState(false);
  const [anggota, setAnggota] = useState<OrangRingkas[]>([]);
  const [galatNama, setGalatNama] = useState<string | null>(null);
  const [galatTopik, setGalatTopik] = useState<string | null>(null);
  const [membuat, setMembuat] = useState(false);
  const [pilihAnggota, setPilihAnggota] = useState(false);
  const inputNama = useRef<TextInput | null>(null);

  const slug = slugKanal(nama);

  const buat = async (): Promise<void> => {
    if (membuat) {
      return;
    }
    setGalatNama(null);
    setGalatTopik(null);
    if (slug.length < 2) {
      setGalatNama(nama.trim() === '' ? 'Nama kanal wajib diisi.' : 'Nama kanal minimal 2 karakter (huruf atau angka).');
      inputNama.current?.focus();
      return;
    }
    if (slug.length > 40) {
      setGalatNama('Nama kanal maksimal 40 karakter.');
      inputNama.current?.focus();
      return;
    }
    setMembuat(true);
    try {
      const hasil = await buatKanalBaru({ name: nama, topic: topik, private: privat, member_ids: anggota.map((a) => a.id) });
      snackbar.show({ message: `Kanal #${hasil.channel.name ?? slug} dibuat`, variant: 'ok' });
      bukaKanal(hasil.channel, saya, true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setGalatNama(err.errors.name?.[0] ?? null);
        setGalatTopik(err.errors.topic?.[0] ?? null);
        if (!err.errors.name && !err.errors.topic) {
          snackbar.show({ message: err.firstValidationError ?? err.message, variant: 'bad' });
        } else {
          inputNama.current?.focus();
        }
      } else {
        snackbar.show({ message: pesanGalat(err, 'Kanal gagal dibuat.'), variant: 'bad', actionLabel: 'Coba lagi', onAction: () => void buat() });
      }
      setMembuat(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ animation: 'slide_from_right' }} />
      <Screen
        header={<SubAppBar title="Kanal baru" onBack={() => router.back()} />}
        footer={<Button title="Buat kanal" loading={membuat} loadingTitle="Membuat…" onPress={() => void buat()} style={{ flex: 1 }} />}
        contentStyle={{ gap: 20 }}
      >
        <Field label="Nama kanal" required error={galatNama} hint={slug.length > 0 ? `Akan tampil sebagai #${slug}` : 'Huruf kecil, angka, dan tanda hubung.'}>
          <Input ref={inputNama} value={nama} onChangeText={setNama} placeholder="mis. acara q4" invalid={galatNama !== null} autoCapitalize="none" autoCorrect={false} maxLength={60} returnKeyType="next" />
        </Field>
        <Field label="Topik (opsional)" error={galatTopik}>
          <Input value={topik} onChangeText={setTopik} placeholder="Untuk apa kanal ini?" invalid={galatTopik !== null} maxLength={250} />
        </Field>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">Kanal privat</Text>
            <Text variant="meta">Hanya anggota yang diundang bisa melihat</Text>
          </View>
          <Switch value={privat} onValueChange={setPrivat} label="Kanal privat" />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label">Undang anggota (opsional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {anggota.map((a) => (
              <Chip key={a.id} label={a.name.split(/\s+/)[0] ?? a.name} variant="tonal" selected onDismiss={() => setAnggota((l) => l.filter((x) => x.id !== a.id))} />
            ))}
            <Chip label="Tambah" icon="plus" onPress={() => setPilihAnggota(true)} />
          </View>
        </View>
      </Screen>

      <BottomSheet visible={pilihAnggota} onClose={() => setPilihAnggota(false)} title="Undang anggota" showClose scrollable>
        <PemilihOrang terpilih={anggota} onUbah={setAnggota} maks={MAKS_ANGGOTA_UNDANG} sembunyikan={saya ? [saya] : []} />
        <Button title="Selesai" onPress={() => setPilihAnggota(false)} />
      </BottomSheet>
    </>
  );
}
