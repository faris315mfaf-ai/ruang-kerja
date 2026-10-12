/**
 * Layar Masuk — email + kata sandi, pesan galat Bahasa Indonesia.
 * 403 (password_change_required / two_factor_required) menampilkan pesan
 * server dan arahan ke web.
 */
import { Ionicons } from '@/ui/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Button, Field, Input } from '@/components/ui';
import { radius, useTheme } from '@/lib/theme';
import { useSession } from '@/session/SessionProvider';

export default function LayarMasuk(): React.JSX.Element {
  const { colors } = useTheme();
  const { masuk } = useSession();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [lihatSandi, setLihatSandi] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim(): Promise<void> {
    if (sibuk) {
      return;
    }
    if (!email.trim() || !sandi) {
      setGalat('Isi email dan kata sandi terlebih dahulu.');
      return;
    }

    setGalat(null);
    setSibuk(true);
    try {
      // Stack.Protected di _layout membawa ke beranda begitu sesi aktif.
      await masuk(email.trim(), sandi);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'password_change_required') {
          setGalat(`${err.message} Buka RuangKerja di peramban, masuk, lalu ganti kata sandi Anda.`);
        } else if (err.code === 'two_factor_required') {
          setGalat(`${err.message}`);
        } else {
          setGalat(err.firstValidationError ?? err.message);
        }
      } else {
        setGalat('Tidak dapat masuk. Periksa koneksi Anda lalu coba lagi.');
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.hiasan, { backgroundColor: colors.linkSoft }]} />
      <View style={styles.tengah}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="finger-print" size={40} color={colors.primaryFg} />
        </View>
        <Text style={[styles.judul, { color: colors.text }]}>RuangKerja</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Masuk dengan akun kantor Anda</Text>

        <View style={styles.form}>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="nama@spkd.store"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              accessibilityLabel="Alamat email"
            />
          </Field>

          <Field label="Kata sandi">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Input
                value={sandi}
                onChangeText={setSandi}
                placeholder="Kata sandi"
                secureTextEntry={!lihatSandi}
                autoComplete="password"
                accessibilityLabel="Kata sandi"
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() => setLihatSandi((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={lihatSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                style={styles.mata}
                hitSlop={8}
              >
                <Ionicons name={lihatSandi ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.subtle} />
              </Pressable>
            </View>
          </Field>

          {galat ? (
            <Text
              style={[styles.galat, { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }]}
              accessibilityRole="alert"
            >
              {galat}
            </Text>
          ) : null}

          <Button title="Masuk" onPress={() => void kirim()} loading={sibuk} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hiasan: {
    position: 'absolute',
    top: -160,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    opacity: 0.6,
  },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  judul: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 4, marginBottom: 26 },
  form: { width: '100%', maxWidth: 400, gap: 14 },
  mata: { position: 'absolute', right: 12, height: 48, justifyContent: 'center' },
  galat: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
