/**
 * Potongan bersama layar Otomasi: gerbang fitur (`features.automation`),
 * label waktu terakhir, dan kartu aturan "Jika … maka …" (mockup 05 › 22).
 */
import { StyleSheet, View } from 'react-native';

import type { BarisAturan } from '@/api/workspace';
import { UbinWorkspace } from '@/features/workspace/bagian';
import { jam, tanggalTanpaTahun, ymdHariIni, ymdJakarta } from '@/lib/format';
import { useSession } from '@/session/SessionProvider';
import { Badge, Card, EmptyState, Screen, Switch, SubAppBar, Text } from '@/ui';
import { tambahHari } from '@/features/workspace/util';

/** Layar dibungkus gerbang: fitur Otomasi mati → keadaan "belum aktif" (menu juga disembunyikan). */
export function GerbangOtomasi({ judul, children }: { judul: string; children: React.ReactNode }): React.JSX.Element {
  const { user } = useSession();
  if (user?.features.automation !== true) {
    return (
      <Screen header={<SubAppBar title={judul} />}>
        <EmptyState icon="workflow" title="Otomasi belum aktif" description="Fitur Otomasi & berulang belum diaktifkan untuk perusahaan Anda. Hubungi admin RuangKerja." variant="plain" />
      </Screen>
    );
  }
  return <>{children}</>;
}

export function terakhirLabel(iso: string | null): string {
  if (!iso) {
    return 'belum pernah berjalan';
  }
  const hari = ymdJakarta(iso);
  const hariIni = ymdHariIni();
  if (hari === hariIni) {
    return `terakhir ${jam(iso)}`;
  }
  if (hari === tambahHari(hariIni, -1)) {
    return 'terakhir kemarin';
  }
  return `terakhir ${tanggalTanpaTahun(iso)}`;
}

export function KartuAturan({
  aturan,
  onPress,
  onJeda,
  sibuk = false,
}: {
  aturan: BarisAturan;
  onPress: () => void;
  /** Sakelar jeda hanya untuk owner/admin workspace. */
  onJeda?: (paused: boolean) => void;
  sibuk?: boolean;
}): React.JSX.Element {
  const dijeda = aturan.paused || !aturan.is_active;
  return (
    <Card onPress={onPress} accessibilityLabel={`${aturan.name}, ${aturan.workspace.name}. ${aturan.sentence}${dijeda ? '. Dijeda' : ''}`} style={{ opacity: dijeda ? 0.78 : 1 }}>
      <View style={s.kepala}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="title" weight={700}>
            {aturan.name}
          </Text>
          <View style={s.baris}>
            <UbinWorkspace nama={aturan.workspace.name} ukuran={22} />
            <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
              {aturan.workspace.name}
            </Text>
            {dijeda ? (
              <Badge tone="neutral" dot={false}>
                Dijeda
              </Badge>
            ) : null}
          </View>
        </View>
        {onJeda ? <Switch value={!dijeda} onValueChange={(aktif) => !sibuk && onJeda(!aktif)} label={dijeda ? `Aktifkan ${aturan.name}` : `Jeda ${aturan.name}`} disabled={sibuk} /> : null}
      </View>
      <Kalimat jika={aturan.jika} maka={aturan.maka} />
      <View style={s.baris}>
        <Text variant="meta" style={{ flex: 1 }}>
          {`${aturan.run_count} kali · ${terakhirLabel(aturan.last_run_at)}`}
        </Text>
        {(aturan.failed_7d ?? 0) > 0 ? <Badge tone="danger">{`${aturan.failed_7d} gagal`}</Badge> : null}
      </View>
    </Card>
  );
}

export function Kalimat({ jika, maka }: { jika: string; maka: string[] }): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <View style={s.kalimat}>
        <Text variant="overline" style={s.kunci}>
          JIKA
        </Text>
        <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 24 }}>
          {jika}
        </Text>
      </View>
      <View style={s.kalimat}>
        <Text variant="overline" style={s.kunci}>
          MAKA
        </Text>
        <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 24 }}>
          {maka.join(' + ')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kalimat: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  kunci: { width: 48, paddingTop: 4 },
});
