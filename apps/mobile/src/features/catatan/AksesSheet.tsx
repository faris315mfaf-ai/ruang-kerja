/** Sheet "Bagikan catatan" (mockup 20): akses umum, orang + peran, undang lewat GET /orang. */
import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { aksesCatatan, cariOrang, simpanAkses, type NoteAccess, type OrangPilihan, type PeranUndangan } from '@/api/catatan';
import { webBase } from '@/api/client';
import { useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, Chip, Icon, IconButton, Loading, Pressable, SearchInput, SegmentedTabs, Text, useSnackbar } from '@/ui';

import { pesanGalat } from './AksiBaris';
import { namaDepan } from './pohon';

interface Orang {
  user_id: string;
  name: string;
  title: string | null;
  role: PeranUndangan;
}

export function AksesSheet({
  visible,
  onClose,
  noteId,
  workspaceName,
}: {
  visible: boolean;
  onClose: () => void;
  noteId: string;
  workspaceName: string | null;
}): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [akses, setAkses] = useState<NoteAccess>('workspace');
  const [penulis, setPenulis] = useState<{ id: string; name: string } | null>(null);
  const [orang, setOrang] = useState<Orang[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [undangTerbuka, setUndangTerbuka] = useState(false);
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<OrangPilihan[] | null>(null);
  const [galatCari, setGalatCari] = useState<string | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      const s = await aksesCatatan(noteId);
      setAkses(s.access);
      setPenulis(s.author ? { id: s.author.id, name: s.author.name } : null);
      setOrang(s.people.map((p) => ({ user_id: p.user_id, name: p.name, title: p.title, role: p.role })));
    } catch (err) {
      setGalat(pesanGalat(err, 'Akses catatan gagal dimuat.'));
    } finally {
      setMemuat(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (visible) {
      /* eslint-disable react-hooks/set-state-in-effect -- muat tiap sheet dibuka */
      setUndangTerbuka(false);
      setQ('');
      setHasil(null);
      void muat();
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [visible, muat]);

  useEffect(() => {
    if (!undangTerbuka) {
      return undefined;
    }
    let batal = false;
    const timer = setTimeout(() => {
      setGalatCari(null);
      cariOrang(q.trim())
        .then((r) => {
          if (!batal) {
            setHasil(r);
          }
        })
        .catch((err: unknown) => {
          if (!batal) {
            setGalatCari(pesanGalat(err, 'Pencarian orang gagal.'));
            setHasil([]);
          }
        });
    }, 300);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [q, undangTerbuka]);

  const tersedia = (hasil ?? []).filter((o) => o.id !== penulis?.id && !orang.some((x) => x.user_id === o.id));

  async function simpan(): Promise<void> {
    setSibuk(true);
    try {
      await simpanAkses(noteId, akses, orang.map((o) => ({ user_id: o.user_id, role: o.role })));
      snackbar.show({ message: 'Akses catatan diperbarui.', variant: 'ok' });
      onClose();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Akses gagal disimpan. Coba lagi.'), variant: 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  async function bagikanTautan(): Promise<void> {
    try {
      await Share.share({ message: `${webBase()}/catatan/${noteId}` });
    } catch {
      snackbar.show({ message: 'Tautan gagal dibagikan.', variant: 'bad' });
    }
  }

  const keteranganAkses =
    akses === 'restricted'
      ? `Hanya ${namaDepan(penulis?.name ?? null) ?? 'penulis'} dan orang di daftar ini yang dapat membuka catatan. Direksi dan HR tidak melihatnya otomatis.`
      : `Semua yang bisa membuka ${workspaceName ?? 'workspace ini'} dapat membaca; anggota yang menyunting tugas juga bisa menyunting.`;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Bagikan catatan" scrollable>
      {memuat && galat === null ? (
        <Loading rows={4} />
      ) : galat !== null ? (
        <View style={{ gap: 8 }}>
          <Text variant="body" tone="danger" accessibilityRole="alert">
            {galat}
          </Text>
          <Button title="Coba lagi" variant="outline" size="sm" onPress={() => void muat()} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Text variant="label" weight={700}>
              Akses umum
            </Text>
            <SegmentedTabs
              value={akses}
              onChange={setAkses}
              options={[
                { value: 'workspace', label: 'Workspace' },
                { value: 'restricted', label: 'Hanya diundang' },
              ]}
            />
            <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
              {keteranganAkses}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text variant="label" weight={700}>
              Orang dengan akses
            </Text>
            {penulis ? (
              <View style={s.baris}>
                <Avatar name={penulis.name} />
                <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
                  {penulis.name}
                </Text>
                <Text variant="meta">Penulis</Text>
              </View>
            ) : null}
            {orang.length === 0 ? (
              <Text variant="meta">Belum ada orang yang diundang.</Text>
            ) : (
              orang.map((o) => (
                <View key={o.user_id} style={[s.baris, { alignItems: 'flex-start' }]}>
                  <Avatar name={o.name} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text variant="title" numberOfLines={1}>
                      {o.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Chip label="Menyunting" selected={o.role === 'edit'} onPress={() => setOrang((l) => l.map((x) => (x.user_id === o.user_id ? { ...x, role: 'edit' } : x)))} />
                      <Chip label="Membaca" selected={o.role === 'view'} onPress={() => setOrang((l) => l.map((x) => (x.user_id === o.user_id ? { ...x, role: 'view' } : x)))} />
                    </View>
                  </View>
                  <IconButton icon="user-minus" label={`Hapus akses ${o.name}`} variant="ghost" size={44} onPress={() => setOrang((l) => l.filter((x) => x.user_id !== o.user_id))} />
                </View>
              ))
            )}

            <Pressable
              onPress={() => setUndangTerbuka((v) => !v)}
              scaleTo={1}
              accessibilityRole="button"
              accessibilityState={{ expanded: undangTerbuka }}
              style={[s.undang, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
            >
              <Icon name="user-plus" size={20} color={colors.link} />
              <Text variant="body" tone="link" weight={600} style={{ flex: 1 }}>
                Undang orang…
              </Text>
              <Icon name={undangTerbuka ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
            </Pressable>
            {undangTerbuka ? (
              <View style={{ gap: 8 }}>
                <SearchInput value={q} onChangeText={setQ} placeholder="Cari nama karyawan" autoFocus />
                {galatCari ? (
                  <Text variant="meta" tone="danger">
                    {galatCari}
                  </Text>
                ) : hasil === null ? (
                  <Text variant="meta">Mencari…</Text>
                ) : tersedia.length === 0 ? (
                  <Text variant="meta">Tidak ada orang yang cocok.</Text>
                ) : (
                  tersedia.map((o) => (
                    <Pressable
                      key={o.id}
                      onPress={() => {
                        setOrang((l) => [...l, { user_id: o.id, name: o.name, title: o.position, role: 'view' }]);
                        setUndangTerbuka(false);
                        setQ('');
                      }}
                      scaleTo={1}
                      accessibilityRole="button"
                      accessibilityLabel={`Undang ${o.name}`}
                      style={s.baris}
                    >
                      <Avatar name={o.name} />
                      <View style={{ flex: 1 }}>
                        <Text variant="title" numberOfLines={1}>
                          {o.name}
                        </Text>
                        {o.position ? (
                          <Text variant="meta" numberOfLines={1}>
                            {o.position}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </View>

          <Button title="Bagikan tautan" icon="link" variant="outline" onPress={() => void bagikanTautan()} />
          <Button title="Simpan akses" onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" />
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  undang: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
});
