/**
 * Detail pengumuman — penerima: "Tutup dari beranda"; pembuat: hapus.
 * Mockup: 10-pengumuman-detail.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { detailPengumuman, hapusPengumuman, tutupSpanduk, type ItemPengumuman } from '@/api/pengumuman';
import { TidakTersedia } from '@/features/inbox/TidakTersedia';
import { penandaTampil, waktuTerbit } from '@/features/pengumuman/format';
import { Badge, Button, Card, ErrorState, Icon, Loading, Screen, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';
import { useTheme } from '@/theme';

export default function LayarDetailPengumuman(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [item, setItem] = useState<ItemPengumuman | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      setItem(await detailPengumuman(id));
    } catch (err) {
      setGalat({ pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat pengumuman.', status: err instanceof ApiError ? err.status : 0 });
    } finally {
      setMemuat(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const galatAksi = (err: unknown, cadangan: string): void => {
    const offline = err instanceof ApiError && err.status === 0;
    snackbar.show({ message: offline ? 'Tidak ada koneksi. Coba lagi saat tersambung.' : err instanceof ApiError ? err.message : cadangan, variant: offline ? 'offline' : 'bad' });
  };

  const hapus = async (): Promise<void> => {
    if (!item) return;
    const ya = await dialog.confirm({
      title: 'Hapus pengumuman?',
      message: `“${item.title}” akan hilang dari semua beranda. Notifikasi yang sudah terkirim tetap ada di Inbox.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ya) return;
    setSibuk(true);
    try {
      await hapusPengumuman(item.id);
      snackbar.show({ message: 'Pengumuman dihapus', variant: 'ok' });
      router.back();
    } catch (err) {
      galatAksi(err, 'Gagal menghapus pengumuman.');
    } finally {
      setSibuk(false);
    }
  };

  const tutup = async (): Promise<void> => {
    if (!item) return;
    setSibuk(true);
    try {
      await tutupSpanduk(item.id);
      setItem({ ...item, dismissed: true });
      snackbar.show({ message: 'Spanduk ditutup. Pengumuman tetap ada di daftar Pengumuman.', variant: 'ok' });
    } catch (err) {
      galatAksi(err, 'Gagal menutup spanduk.');
    } finally {
      setSibuk(false);
    }
  };

  if (galat?.status === 404) {
    return <TidakTersedia jenis="Pengumuman" kembaliKe="/pengumuman" labelKembali="Kembali ke Pengumuman" />;
  }

  const tampil = item ? penandaTampil(item) : null;

  return (
    <Screen
      header={
        <SubAppBar
          title="Pengumuman"
          actions={item?.can_delete ? [{ icon: 'trash-2', label: 'Hapus pengumuman', onPress: () => void hapus(), disabled: sibuk }] : []}
        />
      }
    >
      {memuat ? (
        <Loading rows={4} label="Memuat pengumuman…" />
      ) : galat ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : item && tampil ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone="primary" dot={false}>
              Pengumuman
            </Badge>
            <Badge tone={tampil.tone}>{tampil.teks}</Badge>
          </View>
          <Text variant="h2" accessibilityRole="header">
            {item.title}
          </Text>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            {[item.author?.name, item.audience_label].filter(Boolean).join(' · ')}
            {'\n'}
            {waktuTerbit(item.published_at)}
          </Text>
          <Card>
            <Text variant="body" selectable>
              {item.body}
            </Text>
          </Card>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="users" size={16} color={colors.muted} />
            <Text variant="meta" style={{ fontSize: 14 }}>
              Ditujukan ke {item.audience_label}
              {item.can_delete ? ' · Anda pembuatnya' : ''}
            </Text>
          </View>
          {!item.can_delete && item.active && !item.dismissed ? (
            <Button title="Tutup dari beranda" variant="outline" icon="x" loading={sibuk} onPress={() => void tutup()} />
          ) : null}
          {item.dismissed ? (
            <Text variant="meta" style={{ fontSize: 14 }}>
              Spanduk pengumuman ini sudah Anda tutup dari beranda.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
