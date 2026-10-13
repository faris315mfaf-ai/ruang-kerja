/**
 * Menu ⋯ ruang (mockup 18): Bagikan layar, Tampilan sorotan/petak, Subtitle,
 * Waktu bicara, Gambar-dalam-gambar (belum didukung SDK Android → Segera
 * hadir), Balik kamera, Setelan perangkat & transkrip. Juga lembar Setelan
 * (keluaran suara lewat AudioSession, kamera, opt-out transkrip) dan Waktu
 * bicara (bukan penilaian kinerja).
 */
import { AudioSession } from '@livekit/react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { aturOptOutTranskrip, type NotulenOtomatisRingkas } from '@/api/video';
import { radius, useTheme } from '@/theme';
import { Banner, BottomSheet, Button, Icon, IconTile, Radio, SheetAction, Switch, Text, useSnackbar } from '@/ui';

import { LABEL_KELUARAN, type ArahKamera } from './sesi';
import { durasiBicara, talkRows, talkSummary, type TalkStore } from './waktuBicara';

export function SheetMenu({
  visible,
  onClose,
  berbagiLayar,
  onLayar,
  tampilan,
  onTampilan,
  subtitleAda,
  subtitleNyala,
  onSubtitle,
  onWaktuBicara,
  onBalikKamera,
  kameraNyala,
  onSetelan,
}: {
  visible: boolean;
  onClose: () => void;
  berbagiLayar: boolean;
  onLayar: () => void;
  tampilan: 'sorotan' | 'petak';
  onTampilan: () => void;
  subtitleAda: boolean;
  subtitleNyala: boolean;
  onSubtitle: () => void;
  onWaktuBicara: () => void;
  onBalikKamera: () => void;
  kameraNyala: boolean;
  onSetelan: () => void;
}): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <SheetAction
        icon="screen-share"
        label={berbagiLayar ? 'Berhenti membagikan layar' : 'Bagikan layar'}
        description={berbagiLayar ? undefined : 'Android meminta izin perekaman layar'}
        tone={berbagiLayar ? 'danger' : 'default'}
        onPress={onLayar}
      />
      <SheetAction icon="layout-grid" label={`Tampilan: ${tampilan === 'sorotan' ? 'Sorotan' : 'Petak'}`} description={`ganti ke ${tampilan === 'sorotan' ? 'Petak' : 'Sorotan'}`} onPress={onTampilan} />
      {subtitleAda ? <SheetAction icon="captions" label={subtitleNyala ? 'Sembunyikan subtitle' : 'Tampilkan subtitle'} onPress={onSubtitle} /> : null}
      <SheetAction icon="chart-bar" label="Waktu bicara" onPress={onWaktuBicara} />
      <SheetAction icon="picture-in-picture-2" label="Mode gambar-dalam-gambar" description="Segera hadir — belum didukung ruang video Android" onPress={onClose} />
      {kameraNyala ? <SheetAction icon="switch-camera" label="Balik kamera" onPress={onBalikKamera} /> : null}
      <SheetAction icon="sliders-horizontal" label="Setelan perangkat & transkrip" onPress={onSetelan} />
    </BottomSheet>
  );
}

export function SheetSetelan({
  visible,
  onClose,
  meetingId,
  notulen,
  onNotulenBerubah,
  arah,
  kameraNyala,
  onArah,
  hematData,
  onLihatNotulenOtomatis,
}: {
  visible: boolean;
  onClose: () => void;
  meetingId: string;
  notulen: NotulenOtomatisRingkas | null;
  onNotulenBerubah: (optedOut: boolean) => void;
  arah: ArahKamera;
  kameraNyala: boolean;
  onArah: (arah: ArahKamera) => void;
  hematData: boolean;
  onLihatNotulenOtomatis: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [keluaran, setKeluaran] = useState<string[]>([]);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let aktif = true;
    AudioSession.getAudioOutputs()
      .then((d) => {
        if (aktif) {
          setKeluaran(d);
        }
      })
      .catch(() => undefined);
    return () => {
      aktif = false;
    };
  }, [visible]);

  const pilihKeluaran = async (nilai: string) => {
    try {
      await AudioSession.selectAudioOutput(nilai);
      setDipilih(nilai);
    } catch {
      snackbar.show({ message: 'Keluaran suara tidak tersedia.', variant: 'warn' });
    }
  };

  const ubahOptOut = async (nilai: boolean) => {
    setMenyimpan(true);
    try {
      const hasil = await aturOptOutTranskrip(meetingId, nilai);
      onNotulenBerubah(hasil);
      snackbar.show({ message: hasil ? 'Suara Anda tidak akan ditranskrip.' : 'Suara Anda ikut ditranskrip.', variant: 'ok' });
    } catch (e) {
      snackbar.show({ message: e instanceof Error ? e.message : 'Gagal menyimpan pilihan.', variant: 'bad' });
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Setelan perangkat & transkrip" showClose scrollable snapPoints={['75%', '92%']}>
      {notulen?.auto_minutes ? (
        <>
          <Banner tone="info" icon="file-text" title="Notulen otomatis aktif" message={notulen.notice ?? `Audio dihapus setelah transkripsi${notulen.retention_days ? ` · transkrip ${notulen.retention_days} hari` : ''}.`} />
          {notulen.consent.can_change ? (
            <View style={s.baris}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">Jangan transkrip suara saya</Text>
                <Text variant="meta">Perekaman suara Anda berhenti dan rekaman yang ada dihapus. Pilihan ini privat.</Text>
              </View>
              <Switch value={notulen.consent.opted_out} onValueChange={(v) => void ubahOptOut(v)} disabled={menyimpan} label="Jangan transkrip suara saya" />
            </View>
          ) : null}
          <Button title="Lihat status notulen otomatis" icon="sparkles" variant="quiet" size="sm" onPress={onLihatNotulenOtomatis} />
        </>
      ) : null}

      <Text variant="overline" tone="muted">
        Keluaran suara
      </Text>
      {(keluaran.length > 0 ? keluaran : ['speaker', 'earpiece']).map((k) => {
        const info = LABEL_KELUARAN[k] ?? { label: k, meta: '', ikon: 'volume-2' as const };
        return (
          <View key={k} style={s.baris}>
            <IconTile icon={info.ikon} tone="teal" />
            <Radio selected={dipilih === k} onSelect={() => void pilihKeluaran(k)} label={info.label} description={info.meta} style={{ flex: 1 }} />
          </View>
        );
      })}

      {kameraNyala ? (
        <>
          <Text variant="overline" tone="muted">
            Kamera
          </Text>
          <View style={s.baris}>
            <IconTile icon="smartphone" tone="teal" />
            <Radio selected={arah === 'user'} onSelect={() => onArah('user')} label="Kamera depan" style={{ flex: 1 }} />
          </View>
          <View style={s.baris}>
            <IconTile icon="switch-camera" tone="teal" />
            <Radio selected={arah === 'environment'} onSelect={() => onArah('environment')} label="Kamera belakang" style={{ flex: 1 }} />
          </View>
        </>
      ) : null}

      <View style={[s.info, { backgroundColor: colors.surface2 }]}>
        <Icon name="signal" size={18} color={colors.muted} />
        <Text variant="meta" style={{ flex: 1 }}>
          {hematData ? 'Hemat data seluler aktif: video diterima 360p.' : 'Kualitas video menyesuaikan jaringan otomatis.'} Peredam bising dan gema aktif otomatis.
        </Text>
      </View>
    </BottomSheet>
  );
}

export function SheetWaktuBicara({
  visible,
  onClose,
  talk,
  ids,
  nama,
}: {
  visible: boolean;
  onClose: () => void;
  talk: TalkStore | null;
  ids: string[];
  nama: (identity: string) => string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) {
      return;
    }
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const rows = talk ? talkRows(talk.totals(now), ids) : [];
  const ringkas = talkSummary(rows, (i) => nama(i).split(/\s+/)[0] ?? '');

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Waktu bicara" showClose scrollable>
      <Text variant="meta">Alat membagi giliran, bukan penilaian kinerja.</Text>
      {rows.map((r) => (
        <View key={r.id} style={s.bicara} accessible accessibilityLabel={`${nama(r.id)}: ${Math.round(r.share * 100)} persen, ${durasiBicara(r.ms)}`}>
          <Text variant="label" numberOfLines={1} style={{ width: 84 }}>
            {nama(r.id).split(/\s+/)[0] ?? ''}
          </Text>
          <View style={[s.trek, { backgroundColor: colors.surface2 }]}>
            <View style={{ width: `${Math.round(r.relative * 100)}%`, height: '100%', borderRadius: radius.full, backgroundColor: colors.fill.teal }} />
          </View>
          <Text variant="meta" style={{ width: 96, textAlign: 'right' }}>
            {r.ms < 1000 ? '0% · belum bicara' : `${Math.round(r.share * 100)}% · ${durasiBicara(r.ms)}`}
          </Text>
        </View>
      ))}
      {ringkas ? <Banner tone="info" icon="info" message={ringkas} /> : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  info: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.lg },
  bicara: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  trek: { flex: 1, height: 10, borderRadius: radius.full, overflow: 'hidden' },
});
