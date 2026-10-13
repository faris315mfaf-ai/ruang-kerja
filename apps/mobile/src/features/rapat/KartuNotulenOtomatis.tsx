/**
 * Kartu "Notulen otomatis" di detail rapat (mockup 07, 08-1, 25): belum
 * disiapkan, nyalakan (penyelenggara), aktif + opt-out "Jangan transkrip
 * suara saya", status merekam/mentranskrip/siap/gagal + tautan review.
 */
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { aturNotulenOtomatis, aturPersetujuanTranskrip, ringkasUlang, type RingkasanNotulenOtomatis } from '@/api/rapat';
import { useTheme } from '@/theme';
import { Badge, Button, Card, IconTile, Switch, Text, useDialog, useSnackbar, type Tone } from '@/ui';

const TEKS_DASAR = 'Suara peserta ditranskrip setelah rapat, lalu AI menyusun draf notulen untuk diperiksa notulis.';

export function labelStatusOtomatis(r: RingkasanNotulenOtomatis): { label: string; tone: Tone } | null {
  const t = r.transcript;
  if (!t) {
    return null;
  }
  if (t.status === 'failed') {
    return { label: 'Gagal', tone: 'danger' };
  }
  if (t.status === 'recording') {
    return { label: 'Merekam', tone: 'danger' };
  }
  if (t.status === 'transcribing') {
    return { label: 'Mentranskrip', tone: 'info' };
  }
  if (t.status === 'summarizing') {
    return { label: 'Meringkas', tone: 'info' };
  }
  if (r.draft?.status === 'inserted') {
    return { label: 'Dimasukkan', tone: 'success' };
  }
  return { label: 'Siap', tone: 'success' };
}

export function KartuNotulenOtomatis({
  rapatId,
  tanggal,
  data,
  onUbah,
  onBuka,
  dibatalkan,
}: {
  rapatId: string;
  tanggal: string | null;
  data: RingkasanNotulenOtomatis;
  onUbah: (baru: RingkasanNotulenOtomatis) => void;
  onBuka: () => void;
  dibatalkan: boolean;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [sibuk, setSibuk] = useState(false);
  const status = labelStatusOtomatis(data);

  async function jalankan(fn: () => Promise<void>): Promise<void> {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    try {
      await fn();
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan. Coba lagi.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  async function nyalakan(nilai: boolean): Promise<void> {
    if (nilai) {
      const ok = await dialog.confirm({
        title: 'Nyalakan notulen otomatis?',
        message: `${data.notice ?? `${TEKS_DASAR} Peserta bisa menolak. Transkrip dihapus otomatis setelah ${data.retention_days} hari.`} Berlaku untuk seluruh seri; bisa dimatikan kapan saja dan dicatat di log audit.${data.llm.outside_indonesia ? '\n\nRapat berisi data sensitif (kesehatan, gaji, sanksi, wawancara kandidat) sebaiknya tanpa notulen otomatis. Draf AI dibuat penyedia di luar Indonesia.' : ''}`,
        confirmLabel: 'Nyalakan',
      });
      if (!ok) {
        return;
      }
    } else {
      const ok = await dialog.confirm({ title: 'Matikan notulen otomatis?', message: 'Rapat berikutnya dalam seri ini tidak ditranskrip. Transkrip yang sudah ada tetap tersimpan sampai masa simpannya habis.', confirmLabel: 'Matikan', destructive: true });
      if (!ok) {
        return;
      }
    }
    await jalankan(async () => {
      onUbah(await aturNotulenOtomatis(rapatId, nilai));
      snackbar.show({ message: nilai ? 'Notulen otomatis dinyalakan.' : 'Notulen otomatis dimatikan.', variant: 'ok' });
    });
  }

  async function tolak(nilai: boolean): Promise<void> {
    if (nilai && data.transcript && data.transcript.status !== 'recording') {
      const ok = await dialog.confirm({
        title: 'Hapus ucapan Anda dari transkrip?',
        message: 'Ucapan Anda dihapus dari transkrip dan draf AI, kecuali bagian yang sudah dimasukkan notulis ke notulen — minta notulis memperbaikinya. Kehadiran Anda tidak berubah.',
        confirmLabel: 'Hapus ucapan saya',
        destructive: true,
      });
      if (!ok) {
        return;
      }
    }
    await jalankan(async () => {
      const opted = await aturPersetujuanTranskrip(rapatId, nilai);
      onUbah({ ...data, consent: { ...data.consent, opted_out: opted } });
    });
  }

  if (!data.available) {
    if (!data.can_configure) {
      return null;
    }
    return (
      <Card style={{ gap: 12 }}>
        <View style={s.kepala}>
          <IconTile icon="sparkles" tone="neutral" />
          <View style={{ flex: 1 }}>
            <Text variant="title">Notulen otomatis</Text>
            <Text variant="meta">Belum disiapkan admin di server ini. Notulen otomatis hanya untuk rapat Video RuangKerja.</Text>
          </View>
        </View>
        <Button title="Nyalakan notulen otomatis" variant="secondary" disabled disabledReason="Tidak tersedia" onPress={() => undefined} />
        <Text variant="meta" align="center">
          Tidak tersedia
        </Text>
      </Card>
    );
  }

  if (!data.auto_minutes) {
    if (!data.can_configure || dibatalkan) {
      return null;
    }
    return (
      <Card style={{ gap: 12 }}>
        <View style={s.kepala}>
          <IconTile icon="sparkles" tone="teal" />
          <View style={{ flex: 1 }}>
            <Text variant="title">Nyalakan notulen otomatis</Text>
            <Text variant="meta">Berlaku untuk seluruh seri</Text>
          </View>
          <Switch value={false} onValueChange={(v) => void nyalakan(v)} label="Nyalakan notulen otomatis" disabled={sibuk} />
        </View>
      </Card>
    );
  }

  const opted = data.consent.opted_out;
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.kepala}>
        <IconTile icon="sparkles" tone="teal" />
        <View style={{ flex: 1 }}>
          <Text variant="title">{data.transcript ? 'Notulen otomatis' : 'Notulen otomatis aktif'}</Text>
          <Text variant="meta">{data.transcript ? (data.transcript.status === 'recording' ? 'Merekam suara · peserta bisa menolak' : data.transcript.status_label) : 'Dinyalakan penyelenggara untuk seluruh seri'}</Text>
        </View>
        {data.can_configure && !dibatalkan ? <Switch value onValueChange={(v) => void nyalakan(v)} label="Notulen otomatis" disabled={sibuk} /> : status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      </View>
      {!data.transcript ? (
        <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
          {TEKS_DASAR} Transkrip dihapus otomatis setelah {data.retention_days} hari.
        </Text>
      ) : null}
      {data.transcript?.status === 'failed' ? (
        <Text variant="body" tone="danger" style={{ fontSize: 15 }}>
          Transkripsi gagal.{data.transcript.error ? ` ${data.transcript.error}` : ''}
        </Text>
      ) : null}
      {data.draft?.status === 'ready' && data.can_view_transcript ? <Text variant="label">Draf siap diperiksa</Text> : null}
      {data.can_view_transcript && data.transcript ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {data.transcript.status === 'failed' && data.can_manage ? (
            <Button
              title="Ringkas ulang"
              variant="outline"
              size="sm"
              icon="refresh-cw"
              loading={sibuk}
              onPress={() => void jalankan(async () => onUbah(await ringkasUlang(rapatId, tanggal)))}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            title={data.draft?.status === 'ready' && data.can_manage ? 'Periksa draf notulen' : 'Buka transkrip'}
            variant={data.draft?.status === 'ready' ? 'primary' : 'outline'}
            size="sm"
            icon="sparkles"
            onPress={onBuka}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {data.consent.can_change && !dibatalkan ? (
        <View style={[s.kepala, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: 12 }]}>
          <Switch value={opted} onValueChange={(v) => void tolak(v)} label="Jangan transkrip suara saya" disabled={sibuk} />
          <View style={{ flex: 1 }}>
            <Text variant="label">Jangan transkrip suara saya</Text>
            <Text variant="meta">
              {opted
                ? data.transcript && data.transcript.status !== 'recording'
                  ? 'Ucapan Anda dihapus dari transkrip.'
                  : 'Suara Anda tidak akan ditranskrip. Pilihan ini privat.'
                : data.transcript?.status === 'recording'
                  ? 'Pilihan privat. Perekaman suara Anda berhenti dan rekaman yang ada dihapus.'
                  : 'Suara Anda ikut ditranskrip. Pilihan ini privat.'}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
