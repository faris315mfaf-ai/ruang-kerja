/**
 * Ubin peserta ruang video: video kamera/layar (LiveKit `VideoTrack`), atau
 * avatar inisial di atas `roomTileOff` saat kamera mati; cincin teal saat
 * berbicara, lencana tangan, chip nama + ikon mikrofon mati.
 */
import { VideoTrack, type TrackReference } from '@livekit/react-native';
import { Track, type Participant } from 'livekit-client';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Avatar, Icon, Pressable, Text } from '@/ui';

export interface UbinProps {
  participant: Participant;
  nama: string;
  /** Ubin besar (sorotan / layar presentasi). */
  besar?: boolean;
  /** Tampilkan layar bersama, bukan kamera. */
  layar?: boolean;
  berbicara?: boolean;
  tangan?: boolean;
  /** Kamera depan sendiri dicerminkan. */
  cermin?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function refVideo(p: Participant, layar: boolean): TrackReference | null {
  const source = layar ? Track.Source.ScreenShare : Track.Source.Camera;
  const pub = p.getTrackPublication(source);
  if (!pub || !pub.track || pub.isMuted) {
    return null;
  }
  return { participant: p, publication: pub, source };
}

export function Ubin({ participant, nama, besar = false, layar = false, berbicara = false, tangan = false, cermin = false, onPress, style }: UbinProps): React.JSX.Element {
  const { colors } = useTheme();
  const ref = refVideo(participant, layar);
  const micMati = !participant.isMicrophoneEnabled;
  const label = participant.isLocal ? `${nama.split(/\s+/)[0] ?? nama} (Anda)` : besar ? nama : (nama.split(/\s+/)[0] ?? nama);

  const isi = (
    <View
      style={[
        s.ubin,
        { backgroundColor: ref ? colors.roomBar : colors.roomTileOff, borderColor: berbicara ? colors.primary : 'transparent' },
      ]}
    >
      {ref ? (
        <VideoTrack trackRef={ref} style={StyleSheet.absoluteFill} objectFit={layar ? 'contain' : 'cover'} mirror={cermin} zOrder={besar ? 0 : 1} />
      ) : (
        <View style={s.tengah}>
          <Avatar name={nama} size={besar ? 'lg' : 'md'} />
        </View>
      )}
      {tangan ? (
        <View style={[s.tangan, { backgroundColor: colors.fill.warning }]} accessibilityLabel="Tangan terangkat">
          <Icon name="hand" size={16} color={colors.roomOnCaption} />
        </View>
      ) : null}
      <View style={[s.chip, { backgroundColor: colors.roomCaption }]}>
        {micMati ? <Icon name="mic-off" size={14} color={colors.roomOnCaption} /> : null}
        <Text variant="meta" weight={600} numberOfLines={1} style={{ color: colors.roomOnCaption, flexShrink: 1 }}>
          {layar ? `Layar ${nama.split(/\s+/)[0] ?? nama}` : label}
        </Text>
      </View>
    </View>
  );

  const a11y = `${nama}${participant.isLocal ? ' (Anda)' : ''}${micMati ? ', mikrofon mati' : ''}${ref ? '' : ', kamera mati'}${tangan ? ', tangan terangkat' : ''}${berbicara ? ', sedang berbicara' : ''}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityHint="Buka pilihan peserta" scaleTo={0.98} style={style}>
        {isi}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={a11y} style={style}>
      {isi}
    </View>
  );
}

const s = StyleSheet.create({
  ubin: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 3 },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tangan: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chip: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
