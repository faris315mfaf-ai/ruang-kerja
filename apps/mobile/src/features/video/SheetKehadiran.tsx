/**
 * Panel Kehadiran (mockup 17): Di ruang (dari LiveKit, jam masuk & terlambat
 * dari `GET video/kehadiran`), Belum masuk (Panggil, notulis/penyelenggara,
 * 1×/menit per orang → 429), Dikeluarkan (Izinkan masuk lagi, penyelenggara).
 * Menu peserta penyelenggara: Bisukan (SID track mikrofon), Sematkan di layar
 * saya, Keluarkan (konfirmasi).
 */
import { Track, type Participant, type Room } from 'livekit-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bisukanPeserta, izinkanMasuk, keluarkanPeserta, panggilPeserta, type DataRuang, type KehadiranVideo } from '@/api/video';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, BottomSheet, Button, IconButton, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { pesertaTampil } from './useRuang';

interface Props {
  visible: boolean;
  onClose: () => void;
  room: Room;
  meetingId: string;
  tanggal: string | null;
  data: DataRuang | null;
  kehadiran: KehadiranVideo | null;
  tangan: Record<string, number>;
  nama: (identity: string) => string;
  bisaModerasi: boolean;
  bisaPanggil: boolean;
  disematkan: string | null;
  onSematkan: (identity: string | null) => void;
  onBerubah: () => void;
}

function labelPeran(data: DataRuang | null, userId: string): string | null {
  const p = data?.participants?.find((x) => x.id === userId);
  if (p?.role_label) {
    return p.role_label;
  }
  if (data?.meeting.organizer_id === userId) {
    return 'Penyelenggara';
  }
  if (data?.meeting.minute_taker_id === userId) {
    return 'Notulis';
  }
  return null;
}

function Judul({ teks }: { teks: string }): React.JSX.Element {
  return (
    <Text variant="overline" tone="muted" style={{ marginTop: 8 }}>
      {teks}
    </Text>
  );
}

export function SheetKehadiran(props: Props): React.JSX.Element {
  const { visible, onClose, room, meetingId, tanggal, data, kehadiran, tangan, nama, bisaModerasi, bisaPanggil, disematkan, onSematkan, onBerubah } = props;
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [aksi, setAksi] = useState<Participant | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const diRuang = pesertaTampil(room);
  const belum = (kehadiran?.not_joined ?? []).filter((n) => !diRuang.some((p) => p.identity === n.user_id));
  const dikeluarkan = kehadiran?.removed ?? [];
  const me = room.localParticipant.identity;

  const galat = (e: unknown) => {
    snackbar.show({ message: e instanceof Error ? e.message : 'Gagal. Coba lagi.', variant: 'bad' });
  };

  const panggil = async (userId: string) => {
    setSibuk(userId);
    try {
      await panggilPeserta(meetingId, userId, tanggal);
      snackbar.show({ message: `${nama(userId)} dipanggil.`, variant: 'ok' });
      onBerubah();
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        const detik = e.retryAfter ?? 60;
        snackbar.show({ message: `${nama(userId).split(/\s+/)[0] ?? ''} baru saja dipanggil. Coba lagi dalam ${detik} detik.`, variant: 'info' });
      } else if (e instanceof ApiError && e.status === 422) {
        snackbar.show({ message: e.firstValidationError ?? e.message, variant: 'warn' });
      } else {
        galat(e);
      }
    } finally {
      setSibuk(null);
    }
  };

  const izinkan = async (userId: string) => {
    setSibuk(userId);
    try {
      await izinkanMasuk(meetingId, userId);
      snackbar.show({ message: `${nama(userId)} boleh masuk lagi.`, variant: 'ok' });
      onBerubah();
    } catch (e) {
      galat(e);
    } finally {
      setSibuk(null);
    }
  };

  const bisukan = async (p: Participant) => {
    setAksi(null);
    const sid = p.getTrackPublication(Track.Source.Microphone)?.trackSid;
    if (!sid) {
      snackbar.show({ message: 'Mikrofon peserta tidak ditemukan.', variant: 'warn' });
      return;
    }
    try {
      await bisukanPeserta(meetingId, p.identity, sid);
      snackbar.show({ message: `${nama(p.identity)} dibisukan.`, variant: 'ok' });
    } catch (e) {
      galat(e);
    }
  };

  const keluarkan = async (p: Participant) => {
    setAksi(null);
    const ok = await dialog.confirm({
      title: `Keluarkan ${nama(p.identity)}?`,
      message: 'Ia keluar dari ruang video dan baru bisa masuk lagi setelah Anda menekan "Izinkan masuk lagi". Ia juga tidak bisa menyunting notulen.',
      confirmLabel: 'Keluarkan',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await keluarkanPeserta(meetingId, p.identity);
      snackbar.show({ message: `${nama(p.identity)} dikeluarkan dari rapat.`, variant: 'ok' });
      onBerubah();
    } catch (e) {
      galat(e);
    }
  };

  return (
    <>
      <BottomSheet visible={visible && aksi === null} onClose={onClose} title="Kehadiran" showClose scrollable snapPoints={['70%', '92%']}>
        <Text variant="meta">Otomatis dari ruang · {diRuang.length} di ruang</Text>

        <Judul teks={`Di ruang (${diRuang.length})`} />
        {diRuang.map((p) => {
          const h = kehadiran?.attendance.find((a) => a.user_id === p.identity);
          const peran = labelPeran(data, p.identity);
          const meta = [
            h ? `Masuk ${jam(h.joined_at)}` : null,
            peran,
            p.isMicrophoneEnabled ? null : 'mikrofon mati',
            tangan[p.identity] ? 'tangan terangkat' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const bolehMenu = !p.isLocal;
          return (
            <View key={p.identity} style={[s.baris, { borderTopColor: colors.divider }]}>
              <Avatar name={nama(p.identity)} size="md" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" numberOfLines={1}>
                  {nama(p.identity)}
                  {p.identity === me ? ' (Anda)' : ''}
                </Text>
                {meta ? <Text variant="meta">{meta}</Text> : null}
              </View>
              {h?.late ? <Badge tone="warning">{`Terlambat ${h.late_minutes ?? 0} mnt`}</Badge> : <Badge tone="success">Hadir</Badge>}
              {bolehMenu ? <IconButton icon="ellipsis-vertical" label={`Pilihan untuk ${nama(p.identity)}`} variant="ghost" size={40} onPress={() => setAksi(p)} /> : null}
            </View>
          );
        })}

        {belum.length > 0 ? <Judul teks={`Belum masuk (${belum.length})`} /> : null}
        {belum.map((n) => (
          <View key={n.user_id} style={[s.baris, { borderTopColor: colors.divider }]}>
            <Avatar name={nama(n.user_id)} size="md" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title" numberOfLines={1}>
                {nama(n.user_id)}
              </Text>
              <Text variant="meta">
                {n.called_at ? `Dipanggil ${jam(n.called_at)}` : n.rsvp === 'yes' ? 'Hadir menurut RSVP' : n.rsvp === 'maybe' ? 'RSVP Mungkin' : n.rsvp === 'no' ? 'RSVP Tidak hadir' : 'Belum menjawab RSVP'}
                {n.optional ? ' · opsional' : ''}
              </Text>
            </View>
            {bisaPanggil ? (
              <Button
                title={n.called_at ? 'Panggil lagi' : 'Panggil'}
                size="sm"
                variant={n.called_at ? 'outline' : 'tonal'}
                loading={sibuk === n.user_id}
                onPress={() => void panggil(n.user_id)}
              />
            ) : null}
          </View>
        ))}

        {dikeluarkan.length > 0 ? <Judul teks={`Dikeluarkan (${dikeluarkan.length})`} /> : null}
        {dikeluarkan.map((r) => (
          <View key={r.user_id} style={[s.baris, { borderTopColor: colors.divider }]}>
            <Avatar name={nama(r.user_id)} size="md" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title" numberOfLines={1}>
                {nama(r.user_id)}
              </Text>
              <Text variant="meta">
                {`Dikeluarkan${r.removed_by ? ` ${nama(r.removed_by).split(/\s+/)[0] ?? ''}` : ''}${r.removed_at ? ` ${jam(r.removed_at)}` : ''}`}
              </Text>
            </View>
            {bisaModerasi ? <Button title="Izinkan masuk lagi" size="sm" variant="tonal" loading={sibuk === r.user_id} onPress={() => void izinkan(r.user_id)} /> : null}
          </View>
        ))}
      </BottomSheet>

      <BottomSheet visible={aksi !== null} onClose={() => setAksi(null)}>
        {aksi ? (
          <>
            <View style={[s.baris, { borderTopWidth: 0 }]}>
              <Avatar name={nama(aksi.identity)} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="title">{nama(aksi.identity)}</Text>
                <Text variant="meta">{aksi.isMicrophoneEnabled ? 'Mikrofon menyala' : 'Mikrofon mati'}</Text>
              </View>
            </View>
            {bisaModerasi && aksi.isMicrophoneEnabled ? (
              <SheetAction icon="mic-off" label={`Bisukan ${nama(aksi.identity).split(/\s+/)[0] ?? ''}`} onPress={() => void bisukan(aksi)} />
            ) : null}
            <SheetAction
              icon={disematkan === aksi.identity ? 'pin-off' : 'pin'}
              label={disematkan === aksi.identity ? 'Lepas sematan' : 'Sematkan di layar saya'}
              onPress={() => {
                onSematkan(disematkan === aksi.identity ? null : aksi.identity);
                setAksi(null);
                onClose();
              }}
            />
            {bisaModerasi ? <SheetAction icon="user-x" label="Keluarkan dari rapat" tone="danger" onPress={() => void keluarkan(aksi)} /> : null}
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
