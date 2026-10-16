/**
 * Hiring › Lowongan (mockup 11 › 10): kartu per lowongan (status, divisi,
 * Pelamar · Proses · Diterima, peran saya), sheet "Lowongan baru" (HR/SA).
 * Ketuk kartu: HR → pengaturan lowongan; pewawancara/penyetuju → kandidat
 * lowongan itu. `GET/POST /hiring/lowongan`.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buatLowongan, daftarLowongan, type DaftarLowongan, type KartuLowongan, type RingkasHiring } from '@/api/hiring';
import { tanggalPendek } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, BottomSheet, Button, Card, EmptyState, ErrorState, Fab, Field, Icon, Input, Loading, Pressable, Radio, Screen, Text, errorKindFromStatus, useSnackbar } from '@/ui';

import { galatField, nadaStatusLowongan, pesanGalat } from './format';
import { BannerOffline, HalamanTidakDitemukan } from './parts';
import { useHiringData } from './useHiringData';

function keterangan(p: KartuLowongan): string {
  const divisi = p.division ? `Divisi ${p.division}` : 'Tanpa divisi';
  if (p.status === 'open') {
    return `${divisi} · dibuka ${tanggalPendek(p.opened_at)}`;
  }
  if (p.status === 'closed') {
    return `${divisi} · ditutup ${tanggalPendek(p.closed_at)}`;
  }
  return `${divisi} · belum dibuka`;
}

function Angka({ nilai, label }: { nilai: number; label: string }): React.JSX.Element {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="h3">{String(nilai)}</Text>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}

function KartuLowonganItem({ p, onPress }: { p: KartuLowongan; onPress: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card variant="tight" style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={onPress}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel={`${p.title}, ${p.status_label}, ${p.candidates_count} pelamar, ${p.open_candidates_count} proses, ${p.hired_count} diterima`}
        style={{ padding: 16, gap: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">{p.title}</Text>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {keterangan(p)}
            </Text>
          </View>
          <Badge tone={nadaStatusLowongan(p.status)} dot>
            {p.status_label}
          </Badge>
        </View>
        <View style={[s.angka, { borderTopColor: colors.divider }]}>
          <Angka nilai={p.candidates_count} label="Pelamar" />
          <Angka nilai={p.open_candidates_count} label="Proses" />
          <Angka nilai={p.hired_count} label="Diterima" />
          <Icon name="chevron-right" size={20} color={colors.muted} />
        </View>
        {p.my_roles.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {p.my_roles.includes('interviewer') ? <Badge tone="info">Pewawancara</Badge> : null}
            {p.my_roles.includes('approver') ? <Badge tone="primary">Penyetuju akhir</Badge> : null}
          </View>
        ) : null}
      </Pressable>
    </Card>
  );
}

function SheetLowonganBaru({
  visible,
  divisi,
  onClose,
  onDibuat,
}: {
  visible: boolean;
  divisi: { id: string; name: string }[];
  onClose: () => void;
  onDibuat: (id: string, pesan: string) => void;
}): React.JSX.Element {
  const [judul, setJudul] = useState('');
  const [divisiId, setDivisiId] = useState<string | null>(null);
  const [deskripsi, setDeskripsi] = useState('');
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat sheet dibuka
      setJudul('');
      setDivisiId(null);
      setDeskripsi('');
      setGalat({});
      setGalatUmum(null);
    }
  }, [visible]);

  async function buat(): Promise<void> {
    if (sibuk) {
      return;
    }
    if (judul.trim().length < 3) {
      setGalat({ title: 'Judul minimal 3 karakter.' });
      return;
    }
    setSibuk(true);
    setGalatUmum(null);
    try {
      const hasil = await buatLowongan({ title: judul.trim(), division_id: divisiId, description: deskripsi.trim() === '' ? null : deskripsi.trim() });
      onDibuat(hasil.position.id, hasil.message);
    } catch (err) {
      const g = galatField(err);
      if (Object.keys(g).length > 0) {
        setGalat(g);
      } else {
        setGalatUmum(pesanGalat(err, 'Lowongan gagal dibuat.'));
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Lowongan baru" scrollable>
      <View style={{ gap: 14 }}>
        <Field label="Judul lowongan" required error={galat.title ?? null}>
          <Input
            value={judul}
            onChangeText={(t) => {
              setJudul(t);
              setGalat({});
            }}
            maxLength={150}
            invalid={!!galat.title}
            placeholder="mis. Staf Programmer Backend"
            accessibilityLabel="Judul lowongan"
          />
        </Field>
        {divisi.length > 0 ? (
          <Field label="Divisi" hint="Opsional" error={galat.division_id ?? null}>
            <View>
              <Radio selected={divisiId === null} onSelect={() => setDivisiId(null)} label="Tanpa divisi" />
              {divisi.map((v) => (
                <Radio key={v.id} selected={divisiId === v.id} onSelect={() => setDivisiId(v.id)} label={v.name} />
              ))}
            </View>
          </Field>
        ) : null}
        <Field label="Deskripsi" hint="Opsional" error={galat.description ?? null}>
          <Input value={deskripsi} onChangeText={setDeskripsi} multiline textAlignVertical="top" maxLength={5000} accessibilityLabel="Deskripsi lowongan" />
        </Field>
        <Text variant="meta" style={{ fontSize: 14 }}>
          Tersimpan sebagai Draf. Draf sudah menerima kiriman Google Form, jadi formulir bisa diuji sebelum dibuka.
        </Text>
        {galatUmum ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
            {galatUmum}
          </Text>
        ) : null}
        <Button title="Buat lowongan" onPress={() => void buat()} loading={sibuk} loadingTitle="Membuat…" />
      </View>
    </BottomSheet>
  );
}

export function TabLowongan({
  header,
  onHiring,
  onLihatKandidat,
}: {
  header: React.ReactNode;
  onHiring: (h: RingkasHiring) => void;
  onLihatKandidat: (lowonganId: string) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const [baru, setBaru] = useState(false);
  const m = useHiringData<DaftarLowongan>('lowongan', daftarLowongan);
  const d = m.data;

  useEffect(() => {
    if (d) {
      onHiring(d.hiring);
    }
  }, [d, onHiring]);

  const pertama = useRef(true);
  const muat = m.muat;
  useFocusEffect(
    useCallback(() => {
      if (pertama.current) {
        pertama.current = false;
        return;
      }
      void muat('diam');
    }, [muat]),
  );

  if (m.galat && (m.galat.status === 404 || m.galat.status === 403)) {
    return <HalamanTidakDitemukan />;
  }

  const offline = m.offlineSejak !== null;
  const bolehBuat = d?.can.create === true;

  let isi: React.ReactNode = null;
  if (m.memuat && !d) {
    isi = <Loading rows={4} label="Memuat lowongan…" />;
  } else if (m.galat && !d) {
    isi =
      m.galat.status === 0 ? (
        <ErrorState kind="offline" title="Hiring tidak tersedia offline" message="Data pelamar tidak disimpan di perangkat. Sambungkan internet, lalu coba lagi." onRetry={() => void m.muat()} />
      ) : (
        <ErrorState title="Lowongan gagal dimuat" message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muat()} />
      );
  } else if (d) {
    isi =
      d.positions.length === 0 ? (
        <EmptyState
          icon="briefcase-business"
          title="Belum ada lowongan"
          description={bolehBuat ? 'Buat lowongan, lalu sambungkan Google Form-nya.' : 'Belum ada lowongan yang ditugaskan kepada Anda.'}
          actionLabel={bolehBuat ? 'Lowongan baru' : undefined}
          onAction={bolehBuat ? () => setBaru(true) : undefined}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {d.positions.map((p) => (
            <KartuLowonganItem key={p.id} p={p} onPress={() => (bolehBuat ? router.push(`/hiring/lowongan/${p.id}` as never) : onLihatKandidat(p.id))} />
          ))}
        </View>
      );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muat('tarik')} contentStyle={{ paddingTop: 12, paddingBottom: bolehBuat ? 112 : undefined }}>
        {m.offlineSejak !== null ? <BannerOffline sejak={m.offlineSejak} /> : null}
        {isi}
      </Screen>
      {bolehBuat && d && d.positions.length > 0 ? (
        <Fab icon="plus" label="Lowongan baru" extended onPress={() => (offline ? snackbar.show({ message: 'Membuat lowongan butuh koneksi.', variant: 'offline' }) : setBaru(true))} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 20 }} />
      ) : null}
      <SheetLowonganBaru
        visible={baru}
        divisi={d?.divisions ?? []}
        onClose={() => setBaru(false)}
        onDibuat={(id, pesan) => {
          setBaru(false);
          snackbar.show({ message: pesan, variant: 'ok' });
          void m.muat('diam');
          router.push(`/hiring/lowongan/${id}` as never);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  angka: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
