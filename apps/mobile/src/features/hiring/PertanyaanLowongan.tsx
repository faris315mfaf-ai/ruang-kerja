/**
 * Pertanyaan wawancara di pengaturan lowongan (mockup 11 › 11): daftar
 * bernomor, tambah/ubah (sheet), Naikkan/Turunkan (kirim seluruh urutan),
 * hapus bila belum dipakai. Setiap aksi langsung ke server (terpisah dari
 * "Simpan perubahan" formulir lowongan).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hapusPertanyaan, tambahPertanyaan, ubahPertanyaan, urutkanPertanyaan, type PertanyaanLowongan as Pertanyaan } from '@/api/hiring';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, Card, CountBadge, Field, IconButton, Input, Pressable, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { galatField, pesanGalat } from './format';

export function DaftarPertanyaanLowongan({
  positionId,
  pertanyaan,
  bisaUbah,
  offline,
  onPertanyaan,
}: {
  positionId: string;
  pertanyaan: Pertanyaan[];
  bisaUbah: boolean;
  offline: boolean;
  onPertanyaan: (daftar: Pertanyaan[]) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [menu, setMenu] = useState<Pertanyaan | null>(null);
  const [form, setForm] = useState<{ q: Pertanyaan | null } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [panduan, setPanduan] = useState('');
  const [maks, setMaks] = useState(5);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (form) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang saat sheet dibuka
      setPrompt(form.q?.prompt ?? '');
      setPanduan(form.q?.guidance ?? '');
      setMaks(form.q?.max_score ?? 5);
      setGalat({});
    }
  }, [form]);

  async function simpan(): Promise<void> {
    if (!form || sibuk) {
      return;
    }
    if (prompt.trim().length < 3) {
      setGalat({ prompt: 'Pertanyaan minimal 3 karakter.' });
      return;
    }
    setSibuk(true);
    const isian = { prompt: prompt.trim(), guidance: panduan.trim() === '' ? null : panduan.trim(), max_score: maks };
    try {
      const hasil = form.q ? await ubahPertanyaan(form.q.id, isian) : await tambahPertanyaan(positionId, isian);
      onPertanyaan(hasil.questions);
      setForm(null);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      const g = galatField(err);
      if (Object.keys(g).length > 0) {
        setGalat(g);
      } else {
        setGalat({ umum: pesanGalat(err, 'Pertanyaan gagal disimpan.') });
      }
    } finally {
      setSibuk(false);
    }
  }

  async function geser(q: Pertanyaan, arah: -1 | 1): Promise<void> {
    setMenu(null);
    const ids = pertanyaan.map((x) => x.id);
    const i = ids.indexOf(q.id);
    const j = i + arah;
    if (i < 0 || j < 0 || j >= ids.length) {
      return;
    }
    const lain = ids[j];
    if (lain === undefined) {
      return;
    }
    ids[j] = q.id;
    ids[i] = lain;
    try {
      const hasil = await urutkanPertanyaan(positionId, ids);
      onPertanyaan(hasil.questions);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Urutan gagal disimpan.'), variant: 'bad' });
    }
  }

  async function hapus(q: Pertanyaan): Promise<void> {
    setMenu(null);
    const ok = await dialog.confirm({ title: 'Hapus pertanyaan ini?', message: `“${q.prompt}”`, confirmLabel: 'Hapus', destructive: true });
    if (!ok) {
      return;
    }
    try {
      const hasil = await hapusPertanyaan(q.id);
      onPertanyaan(hasil.questions);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Pertanyaan gagal dihapus.'), variant: 'bad' });
    }
  }

  const indeksMenu = menu ? pertanyaan.findIndex((x) => x.id === menu.id) : -1;

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="h3" style={{ flex: 1 }}>
          Pertanyaan wawancara
        </Text>
        {pertanyaan.length > 0 ? <CountBadge count={pertanyaan.length} /> : null}
      </View>
      {pertanyaan.length === 0 ? (
        <Text variant="body" tone="muted">
          Belum ada pertanyaan. Pewawancara memberi poin per pertanyaan.
        </Text>
      ) : (
        pertanyaan.map((q, i) => (
          <View key={q.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.divider, paddingTop: i > 0 ? 8 : 0 }}>
            <View style={{ flex: 1, gap: 2, paddingVertical: 4 }}>
              <Text variant="label">{`${i + 1}. ${q.prompt}`}</Text>
              <Text variant="meta">{`Maks ${q.max_score} poin${q.locked ? ' · sudah dipakai (tidak bisa dihapus)' : ''}`}</Text>
            </View>
            {bisaUbah ? <IconButton icon="ellipsis-vertical" label={`Aksi pertanyaan ${i + 1}`} variant="ghost" onPress={() => setMenu(q)} disabled={offline} /> : null}
          </View>
        ))
      )}
      {bisaUbah ? <Button title="Tambah pertanyaan" variant="tonal" icon="plus" onPress={() => setForm({ q: null })} disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} /> : null}

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu ? `Pertanyaan ${indeksMenu + 1}` : undefined}>
        <SheetAction
          icon="pencil"
          label="Ubah pertanyaan"
          onPress={() => {
            const q = menu;
            setMenu(null);
            if (q) {
              setForm({ q });
            }
          }}
        />
        {indeksMenu > 0 ? <SheetAction icon="arrow-up" label="Naikkan" onPress={() => (menu ? void geser(menu, -1) : undefined)} /> : null}
        {indeksMenu >= 0 && indeksMenu < pertanyaan.length - 1 ? <SheetAction icon="arrow-down" label="Turunkan" onPress={() => (menu ? void geser(menu, 1) : undefined)} /> : null}
        {menu?.can_delete ? <SheetAction icon="trash-2" label="Hapus pertanyaan" tone="danger" onPress={() => (menu ? void hapus(menu) : undefined)} /> : null}
        {menu && !menu.can_delete ? (
          <Text variant="meta" style={{ fontSize: 14, paddingVertical: 8 }}>
            Pertanyaan yang sudah punya jawaban atau poin tidak bisa dihapus.
          </Text>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={form !== null} onClose={() => setForm(null)} title={form?.q ? 'Ubah pertanyaan' : 'Tambah pertanyaan'} scrollable>
        <View style={{ gap: 14 }}>
          <Field label="Pertanyaan" required error={galat.prompt ?? null}>
            <Input
              value={prompt}
              onChangeText={(t) => {
                setPrompt(t);
                setGalat({});
              }}
              multiline
              textAlignVertical="top"
              maxLength={2000}
              invalid={!!galat.prompt}
              accessibilityLabel="Pertanyaan wawancara"
            />
          </Field>
          <Field label="Panduan pewawancara" hint="Opsional" error={galat.guidance ?? null}>
            <Input value={panduan} onChangeText={setPanduan} multiline textAlignVertical="top" maxLength={2000} accessibilityLabel="Panduan pewawancara" />
          </Field>
          <Field label="Poin maksimal" error={galat.max_score ?? null}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const aktif = maks === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setMaks(n)}
                    scaleTo={0.94}
                    accessibilityRole="radio"
                    accessibilityLabel={`Poin maksimal ${n}`}
                    accessibilityState={{ selected: aktif }}
                    style={{ width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: aktif ? colors.primary : colors.surface, borderColor: aktif ? colors.primary : colors.borderStrong }}
                  >
                    <Text variant="title" weight={700} style={{ color: aktif ? colors.primaryFg : colors.text }}>
                      {String(n)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
          {galat.umum ? (
            <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
              {galat.umum}
            </Text>
          ) : null}
          <Button title="Simpan pertanyaan" onPress={() => void simpan()} loading={sibuk} loadingTitle="Menyimpan…" />
        </View>
      </BottomSheet>
    </Card>
  );
}
