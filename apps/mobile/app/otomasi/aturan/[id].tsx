/**
 * Detail aturan (mockup 05 › 22-3): kalimat Jika/Maka dan riwayat eksekusi;
 * jeda/aktifkan untuk owner/admin. GET /otomasi/aturan/{id}.
 */
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ambilDetailAturan, jedaAturan, type RunAturan } from '@/api/workspace';
import { GerbangOtomasi, Kalimat, terakhirLabel } from '@/features/otomasi/bagian';
import { UbinWorkspace, GalatMuat, PitaOffline } from '@/features/workspace/bagian';
import { hapusCache, useResource } from '@/features/workspace/useResource';
import { tanggalJam } from '@/lib/format';
import { Badge, Button, Card, DesktopOnlyBanner, EmptyState, Loading, Screen, SubAppBar, Text, useDialog, useSnackbar, type Tone } from '@/ui';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { useState } from 'react';

const NADA: Record<RunAturan['result'], Tone> = { success: 'success', failed: 'danger', skipped: 'neutral' };

function Isi(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kunci = typeof id === 'string' ? id : '';
  const snackbar = useSnackbar();
  const dialog = useDialog();
  const { kirim, mengirim } = useKirimTautan();
  const det = useResource(kunci !== '' ? `otomasi:aturan-detail:${kunci}` : null, () => ambilDetailAturan(kunci));
  const [sibuk, setSibuk] = useState(false);
  const d = det.data;
  const dijeda = d ? d.aturan.paused || !d.aturan.is_active : false;

  async function ubahJeda(): Promise<void> {
    if (!d || sibuk) {
      return;
    }
    const jedakan = !dijeda;
    if (jedakan) {
      const ya = await dialog.confirm({
        title: `Jeda aturan “${d.aturan.name}”?`,
        message: 'Aturan tidak berjalan sampai diaktifkan lagi. Riwayat eksekusi tetap tersimpan.',
        confirmLabel: 'Jeda',
      });
      if (!ya) {
        return;
      }
    }
    setSibuk(true);
    try {
      const h = await jedaAturan(d.aturan.id, jedakan);
      det.ubah((lama) => ({ ...lama, aturan: { ...lama.aturan, ...h.aturan } }));
      hapusCache('otomasi:aturan:');
      snackbar.show({ message: h.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Aturan gagal diubah.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Screen header={<SubAppBar title={d?.aturan.name ?? 'Aturan'} />} refreshing={det.menyegarkan} onRefresh={() => void det.muat()}>
      {det.memuat && !d ? (
        <Loading rows={4} />
      ) : det.galat && !d ? (
        <GalatMuat galat={det.galat} judul="Aturan belum bisa dimuat" onCoba={() => void det.muat()} />
      ) : d ? (
        <>
          {det.offline ? <PitaOffline diperbarui={det.diperbarui} objek="aturan" /> : null}
          <Card>
            <View style={s.baris}>
              <UbinWorkspace nama={d.aturan.workspace.name} ukuran={28} />
              <Text variant="meta" style={{ flex: 1, fontSize: 14 }}>{`${d.aturan.workspace.name} · ${d.aturan.workspace.key}`}</Text>
              <Badge tone={dijeda ? 'neutral' : 'success'}>{dijeda ? 'Dijeda' : 'Aktif'}</Badge>
            </View>
            <Kalimat jika={d.aturan.jika} maka={d.aturan.maka} />
            <Text variant="meta">{`${d.aturan.run_count} kali · ${terakhirLabel(d.aturan.last_run_at)}`}</Text>
          </Card>

          <Text variant="h3" accessibilityRole="header">
            Riwayat eksekusi
          </Text>
          {d.runs.length === 0 ? (
            <EmptyState icon="history" title="Belum ada eksekusi" description="Riwayat muncul setelah aturan ini berjalan." variant="plain" />
          ) : (
            <Card variant="tight">
              {d.runs.map((r) => (
                <View key={r.id} style={s.run} accessible accessibilityLabel={`${r.result_label}, ${r.task_key}, ${r.detail}, ${tanggalJam(r.ran_at)}`}>
                  <Badge tone={NADA[r.result]}>{r.result_label}</Badge>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" style={{ fontSize: 15 }} numberOfLines={1}>
                      {r.task_key} {r.task_title}
                    </Text>
                    <Text variant="meta">{r.detail}</Text>
                  </View>
                  <Text variant="meta">{tanggalJam(r.ran_at)}</Text>
                </View>
              ))}
            </Card>
          )}

          {d.aturan.can_manage ? (
            <Button title={dijeda ? 'Aktifkan aturan' : 'Jeda aturan'} icon={dijeda ? 'zap' : 'pause'} variant={dijeda ? 'primary' : 'outline'} loading={sibuk} onPress={() => void ubahJeda()} />
          ) : (
            <Text variant="meta">Hanya Owner atau Admin workspace yang bisa menjeda aturan.</Text>
          )}
          <DesktopOnlyBanner message="Mengubah kondisi dan aksi aturan dilakukan di RuangKerja web." onSendLink={mengirim ? undefined : () => void kirim('/otomasi')} />
        </>
      ) : null}
    </Screen>
  );
}

export default function LayarDetailAturan(): React.JSX.Element {
  return (
    <GerbangOtomasi judul="Aturan">
      <Isi />
    </GerbangOtomasi>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  run: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 6 },
});
