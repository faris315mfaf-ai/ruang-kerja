/**
 * Update proyek oleh PIC (mockup 06 › 08; `POST /proyek/{key}/update`): status
 * kesehatan 3 pilihan, Ringkasan (wajib), Hambatan, Keputusan dari Direksi,
 * kartu "disimpan bersama" (progres & rencana diisi server). Galat 422 per
 * field, offline menonaktifkan kirim, dialog "Buang update?" saat kembali.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { kirimUpdate, type Kesehatan } from '@/api/proyek';
import { labelPenanda, LABEL_KESEHATAN, persen } from '@/features/proyek/format';
import { pesanGalat } from '@/features/proyek/tunda';
import { useJagaBuang } from '@/features/proyek/useJagaBuang';
import { useProyek } from '@/features/proyek/useProyek';
import { useTheme } from '@/theme';
import { Banner, Button, Card, ErrorState, Field, Icon, Input, LockedState, Pressable, Screen, Skeleton, SubAppBar, Text, errorKindFromStatus, useSnackbar } from '@/ui';

const PILIHAN: { value: Kesehatan; ikon: 'circle-check' | 'triangle-alert' | 'circle-alert'; ket: string }[] = [
  { value: 'on_track', ikon: 'circle-check', ket: 'Berjalan sesuai rencana' },
  { value: 'at_risk', ikon: 'triangle-alert', ket: 'Ada hambatan, masih bisa dikejar' },
  { value: 'off_track', ikon: 'circle-alert', ket: 'Perlu bantuan atau keputusan' },
];

export default function LayarUpdateProyek(): React.JSX.Element {
  const { colors } = useTheme();
  const { key: param } = useLocalSearchParams<{ key: string }>();
  const key = typeof param === 'string' ? param : '';
  const r = useProyek(key);
  const snackbar = useSnackbar();
  const [health, setHealth] = useState<Kesehatan | null>(null);
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [decision, setDecision] = useState('');
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [mengirim, setMengirim] = useState(false);
  const adaIsi = health !== null || summary.trim() !== '' || blockers.trim() !== '' || decision.trim() !== '';
  const jaga = useJagaBuang(adaIsi && !mengirim, 'Buang update?', 'Update yang Anda tulis belum dikirim.');
  const d = r.data;

  if (!d) {
    return (
      <Screen header={<SubAppBar title="Update proyek" />}>
        {r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Skeleton height={240} radiusPx={24} />}
      </Screen>
    );
  }
  if (!d.can.post_update) {
    return (
      <Screen header={<SubAppBar title="Update proyek" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Hanya PIC" reason="Update proyek ditulis PIC atau admin workspace proyek ini." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const p = d.project;
  const m = p.metrics;

  const kirim = async (): Promise<void> => {
    const g: Record<string, string> = {};
    if (!health) g.health = 'Pilih status kesehatan proyek.';
    if (summary.trim() === '') g.summary = 'Ringkasan wajib diisi.';
    setGalat(g);
    if (Object.keys(g).length > 0 || !health) return;
    setMengirim(true);
    try {
      const hasil = await kirimUpdate(p.key, {
        health,
        summary: summary.trim(),
        blockers: blockers.trim() === '' ? null : blockers.trim(),
        decision_needed: decision.trim() === '' ? null : decision.trim(),
      });
      jaga.izinkanKeluar();
      snackbar.show({ message: hasil.message, variant: 'ok' });
      void r.muat();
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const baru: Record<string, string> = {};
        for (const [f, pesan] of Object.entries(err.errors)) if (pesan[0]) baru[f === 'decision_needed' ? 'decision' : f] = pesan[0];
        setGalat(baru);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Update gagal dikirim.'), variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
      }
    } finally {
      setMengirim(false);
    }
  };

  return (
    <Screen
      header={<SubAppBar title={`Update · ${p.key}`} />}
      footer={
        <>
          <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title="Kirim update" icon="send" loading={mengirim} loadingTitle="Mengirim…" disabled={r.offline} disabledReason={r.offline ? 'Butuh koneksi' : undefined} style={{ flex: 1.4 }} onPress={() => void kirim()} />
        </>
      }
    >
      {r.offline ? <Banner tone="warn" icon="wifi-off" message="Anda offline. Update bisa ditulis, tetapi baru bisa dikirim saat tersambung." /> : null}
      <Text variant="meta" style={{ fontSize: 15 }}>
        {p.name}
      </Text>
      <Field label="Status kesehatan" required error={galat.health || null}>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {PILIHAN.map((o) => {
            const pilih = health === o.value;
            const warna = o.value === 'on_track' ? colors.success : o.value === 'at_risk' ? colors.warning : colors.danger;
            const lembut = o.value === 'on_track' ? colors.successSoft : o.value === 'at_risk' ? colors.warningSoft : colors.dangerSoft;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  setHealth(o.value);
                  setGalat((g) => ({ ...g, health: '' }));
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: pilih }}
                accessibilityLabel={`${LABEL_KESEHATAN[o.value]}: ${o.ket}`}
                style={{
                  minHeight: 60,
                  borderRadius: 16,
                  borderWidth: pilih ? 2 : 1,
                  borderColor: pilih ? warna : colors.borderStrong,
                  backgroundColor: pilih ? lembut : colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                }}
              >
                <Icon name={o.ikon} size={22} color={warna} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{LABEL_KESEHATAN[o.value]}</Text>
                  <Text variant="meta">{o.ket}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label="Ringkasan" required error={galat.summary || null} counter={`${summary.length}/2.000`}>
        <Input value={summary} onChangeText={setSummary} multiline maxLength={2000} invalid={!!galat.summary} placeholder="Apa yang selesai minggu ini dan apa berikutnya?" accessibilityLabel="Ringkasan" />
      </Field>
      <Field label="Hambatan" hint="Opsional" error={galat.blockers || null}>
        <Input value={blockers} onChangeText={setBlockers} multiline maxLength={2000} invalid={!!galat.blockers} placeholder="Apa yang menghambat?" accessibilityLabel="Hambatan" />
      </Field>
      <Field label="Keputusan yang dibutuhkan dari Direksi" hint="Opsional · sponsor (atau semua Direksi) diberi tahu" error={galat.decision || null}>
        <Input value={decision} onChangeText={setDecision} multiline maxLength={1000} invalid={!!galat.decision} placeholder="Mis. Tambahan anggaran vendor video." accessibilityLabel="Keputusan yang dibutuhkan dari Direksi" />
      </Field>
      <Card variant="flat" style={{ gap: 6 }}>
        <Text variant="label">Disimpan bersama update ini</Text>
        <Text variant="body" tone="muted" style={{ fontSize: 15 }}>{`Progres aktual ${persen(m.actual)} · rencana ${persen(m.planned)}`}</Text>
        <Text variant="meta">{m.flags.length > 0 ? `Penanda sistem: ${m.flags.map((f) => labelPenanda(f, m.variance)).join(', ')}` : 'Tidak ada penanda sistem.'}</Text>
      </Card>
    </Screen>
  );
}
