/**
 * Pintasan "Tidak masuk hari ini? Ajukan Sakit / Izin" di layar Absen
 * (docs/sesi/ponsel-b6-sakit-izin.md §4). Tiga keadaan dari `state.leaveShortcut`:
 *  - `pending`   → baris status yang membuka detail pengajuan;
 *  - `available` → kartu dengan tombol Sakit / Izin (jenis yang batasnya sudah lewat disembunyikan);
 *  - `closedReason` → catatan redup bahwa batas jam sudah lewat.
 * Aturan batas (jam server) ditegakkan server; kartu hanya menampilkan dan membuka form.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { JenisPintasan, PintasanCuti } from '@/api/absensi';
import { Banner, Button, Card, IconTile, ListRow, Text } from '@/ui';

/** "12:00" → "12.00" (format jam Indonesia). */
function jamId(hhmm: string | null): string | null {
  return hhmm ? hhmm.slice(0, 5).replace(':', '.') : null;
}

function bukaForm(jenis: JenisPintasan, tanggal: string): void {
  router.push({ pathname: '/pengajuan/form', params: { tipe: jenis.id, tanggal } });
}

/** Kalimat batas untuk jenis yang masih terbuka: "pukul 12.00" atau "Sakit pukul 12.00 · Izin pukul 14.00". */
function teksBatas(p: PintasanCuti): string | null {
  const sakit = p.sickType && !p.sickClosed ? jamId(p.sickCutoff) : null;
  const izin = p.permitType && !p.permitClosed ? jamId(p.permitCutoff) : null;
  if (sakit && izin) {
    return sakit === izin ? `Batas pengajuan hari ini pukul ${sakit}` : `Batas pengajuan hari ini: Sakit pukul ${sakit} · Izin pukul ${izin}`;
  }
  const satu = sakit ?? izin;
  return satu ? `Batas pengajuan hari ini pukul ${satu}` : null;
}

export function KartuSakitIzin({ pintasan, officeDate }: { pintasan: PintasanCuti | null | undefined; officeDate: string }): React.JSX.Element | null {
  if (!pintasan) {
    return null;
  }

  const menunggu = pintasan.pending;
  if (menunggu) {
    const revisi = menunggu.status === 'revision_requested';
    return (
      <Card variant="flat">
        <ListRow
          icon={revisi ? 'undo-2' : 'hourglass'}
          iconTone={revisi ? 'blue' : 'warn'}
          title={revisi ? `Pengajuan ${menunggu.typeLabel} perlu direvisi` : `Pengajuan ${menunggu.typeLabel} menunggu persetujuan`}
          subtitle={`${menunggu.number ?? 'Draf'} · ${menunggu.statusLabel}`}
          accessibilityLabel={`Pengajuan ${menunggu.typeLabel} ${menunggu.number ?? ''}, ${menunggu.statusLabel}. Buka detail pengajuan.`}
          onPress={() => router.push(`/pengajuan/${menunggu.id}`)}
        />
      </Card>
    );
  }

  if (pintasan.available) {
    const sakit = pintasan.sickType && !pintasan.sickClosed ? pintasan.sickType : null;
    const izin = pintasan.permitType && !pintasan.permitClosed ? pintasan.permitType : null;
    if (!sakit && !izin) {
      return null;
    }
    const batas = teksBatas(pintasan);
    return (
      <Card style={{ gap: 12 }}>
        <View style={s.baris}>
          <IconTile icon="stethoscope" tone="bad" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" weight={700} accessibilityRole="header">
              Tidak masuk hari ini?
            </Text>
            <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
              Ajukan Sakit atau Izin untuk disetujui atasan.
            </Text>
          </View>
        </View>
        <View style={s.baris}>
          {sakit ? (
            <Button title="Sakit" icon="stethoscope" variant="tonal" style={{ flex: 1 }} onPress={() => bukaForm(sakit, officeDate)} accessibilityHint="Buka form pengajuan sakit untuk hari ini" />
          ) : null}
          {izin ? (
            <Button title="Izin" icon="door-open" variant="outline" style={{ flex: 1 }} onPress={() => bukaForm(izin, officeDate)} accessibilityHint="Buka form pengajuan izin untuk hari ini" />
          ) : null}
        </View>
        {batas ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            {batas}. Lewat batas dan tidak absen, hari ini tercatat alpha.
          </Text>
        ) : null}
        {pintasan.sickClosed !== pintasan.permitClosed && (!sakit || !izin) ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            {!sakit ? 'Batas pengajuan sakit hari ini sudah lewat.' : 'Batas pengajuan izin hari ini sudah lewat.'}
          </Text>
        ) : null}
      </Card>
    );
  }

  if (pintasan.closedReason) {
    return <Banner tone="neutral" icon="clock-alert" message={`${pintasan.closedReason} Hari ini tercatat alpha bila Anda tidak absen.`} />;
  }
  return null;
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
