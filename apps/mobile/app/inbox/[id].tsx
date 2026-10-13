/**
 * Detail notifikasi layar penuh — briefing (teks lengkap, "Informatif") dan
 * notifikasi tanpa tujuan yang dibuka dari luar daftar (push, hasil cari).
 * Membuka = menandai dibaca. Mockup: 07-inbox-detail layar 1–2.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { aksiInbox, detailInbox, type EntriInbox } from '@/api/inbox';
import { TidakTersedia } from '@/features/inbox/TidakTersedia';
import { ikonNotifikasi } from '@/features/inbox/ikon';
import { jamKantor, labelHari } from '@/features/inbox/waktu';
import { useUnread } from '@/session/UnreadProvider';
import { useTheme } from '@/theme';
import { Badge, Button, Card, ErrorState, Icon, Loading, Screen, SubAppBar, Text, errorKindFromStatus, useSnackbar } from '@/ui';

export default function LayarDetailInbox(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { perbarui } = useUnread();
  const snackbar = useSnackbar();
  const [item, setItem] = useState<EntriInbox | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await detailInbox(id);
      setItem(hasil.item);
      perbarui(hasil.unread);
      if (hasil.item.read_at === null) {
        const sesudah = await aksiInbox(id, 'baca').catch(() => null);
        if (sesudah) {
          perbarui(sesudah.unread);
          setItem({ ...hasil.item, read_at: new Date().toISOString() });
        }
      }
    } catch (err) {
      setGalat({ pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat notifikasi.', status: err instanceof ApiError ? err.status : 0 });
    } finally {
      setMemuat(false);
    }
  }, [id, perbarui]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const ubah = async (aksi: 'belum-baca' | 'arsip' | 'batal-arsip'): Promise<void> => {
    setSibuk(true);
    try {
      const hasil = await aksiInbox(id, aksi);
      perbarui(hasil.unread);
      snackbar.show({
        message: aksi === 'arsip' ? 'Notifikasi diarsipkan' : aksi === 'batal-arsip' ? 'Dikembalikan ke Inbox' : 'Ditandai belum dibaca',
        variant: 'ok',
      });
      router.back();
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError && err.status === 0 ? 'Tidak ada koneksi. Coba lagi saat tersambung.' : 'Aksi gagal. Coba lagi.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    } finally {
      setSibuk(false);
    }
  };

  if (galat?.status === 404) {
    return <TidakTersedia jenis="Notifikasi" />;
  }

  const hariIni = item ? labelHari(item.created_at) : null;

  return (
    <Screen
      header={<SubAppBar title={item?.type_label ?? 'Notifikasi'} />}
      footer={
        item ? (
          <>
            <Button title="Belum dibaca" variant="outline" icon="mail" style={{ flex: 1 }} disabled={sibuk} onPress={() => void ubah('belum-baca')} />
            <Button
              title={item.archived_at ? 'Kembalikan' : 'Arsipkan'}
              icon={item.archived_at ? 'archive-restore' : 'archive'}
              style={{ flex: 1.2 }}
              disabled={sibuk}
              onPress={() => void ubah(item.archived_at ? 'batal-arsip' : 'arsip')}
            />
          </>
        ) : undefined
      }
    >
      {memuat ? (
        <Loading label="Memuat notifikasi…" rows={4} />
      ) : galat ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : item ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Badge tone="primary" dot={false}>
              {item.type_label}
            </Badge>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {jamKantor(item.created_at)}
              {item.actor?.name ? ` · ${item.actor.name}` : ''}
              {hariIni && hariIni.label !== 'Hari ini' ? ` · ${hariIni.label}` : ''}
            </Text>
          </View>
          <Text variant="h2" accessibilityRole="header">
            {item.title}
          </Text>
          {item.body ? (
            <Card>
              <Text variant="body" selectable>
                {item.body}
              </Text>
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name={ikonNotifikasi(item.icon)} size={18} color={colors.muted} />
              <Text variant="meta">Tidak ada isi tambahan.</Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}
