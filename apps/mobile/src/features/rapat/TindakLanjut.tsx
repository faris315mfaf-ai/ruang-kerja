/**
 * Tindak lanjut notulen (mockup 08 › 21, 22-1, 23): daftar + centang
 * selesai (PIC/notulis/penyelenggara), tambah/ubah/hapus (penulis), PIC dari
 * peserta, tenggat, "Jadikan tugas" (pilih workspace bila rapat tanpa
 * workspace), "Jadikan semua tugas", "Ingatkan PIC" (maks. sekali sehari).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  hapusTindakLanjut,
  ingatkanPic,
  jadikanSemuaTugas,
  jadikanTugas,
  tambahTindakLanjut,
  ubahTindakLanjut,
  type Notulen,
  type TindakLanjut as Item,
  type WorkspaceRingkas,
} from '@/api/rapat';
import { SheetInput } from '@/features/tugas/Pilihan';
import { ymdHariIni } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, Checkbox, DateInput, Pressable, Radio, Tag, Text, useDialog, useSnackbar } from '@/ui';

import { hariSingkat, namaDepan } from './util';

export interface OrangRapat {
  id: string;
  nama: string;
}

function ketTenggat(due: string | null, done: boolean): { teks: string; telat: boolean } | null {
  if (!due) {
    return null;
  }
  const hariIni = ymdHariIni();
  if (!done && due < hariIni) {
    const selisih = Math.round((Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000);
    return { teks: `Lewat ${selisih} hari`, telat: true };
  }
  return { teks: hariSingkat(due), telat: false };
}

export function TindakLanjutKartu({
  rapatId,
  tanggal,
  items,
  orang,
  viewerId,
  bolehTulis,
  bolehKelola,
  workspace,
  workspaces,
  final,
  offline,
  onItems,
  onNotulen,
}: {
  rapatId: string;
  tanggal: string | null;
  items: Item[];
  orang: OrangRapat[];
  viewerId: string | null;
  /** editMinutes: tambah/ubah/hapus (hanya draf). */
  bolehTulis: boolean;
  /** manageActionItems: jadikan tugas, ingatkan. */
  bolehKelola: boolean;
  workspace: WorkspaceRingkas | null;
  workspaces: WorkspaceRingkas[];
  final: boolean;
  offline: boolean;
  onItems: (items: Item[]) => void;
  onNotulen: (n: Notulen) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const dialog = useDialog();
  const [lembar, setLembar] = useState<null | { mode: 'baru' } | { mode: 'ubah'; item: Item }>(null);
  const [teks, setTeks] = useState('');
  const [pic, setPic] = useState<string | null>(null);
  const [tenggat, setTenggat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pilihWs, setPilihWs] = useState<null | { ids: string[] }>(null);
  const [galatWs, setGalatWs] = useState<string | null>(null);
  const [diingatkan, setDiingatkan] = useState(false);
  const tulis = bolehTulis && !final;

  const nama = (id: string | null): string => (id ? (orang.find((o) => o.id === id)?.nama ?? 'Karyawan') : '');
  const ganti = (baru: Item): void => onItems(items.map((x) => (x.id === baru.id ? baru : x)));

  function galat(err: unknown, cadangan: string): void {
    const offlineErr = err instanceof ApiError && err.status === 0;
    snackbar.show({ message: offlineErr ? 'Tanpa koneksi. Coba lagi saat tersambung.' : err instanceof ApiError ? (err.firstValidationError ?? err.message) : cadangan, variant: offlineErr ? 'offline' : 'bad' });
  }

  function buka(item: Item | null): void {
    if (item) {
      setTeks(item.text);
      setPic(item.assignee_id);
      setTenggat(item.due_date ?? '');
      setLembar({ mode: 'ubah', item });
    } else {
      setTeks('');
      setPic(null);
      setTenggat('');
      setLembar({ mode: 'baru' });
    }
  }

  async function simpan(): Promise<void> {
    if (!lembar || teks.trim() === '' || sibuk) {
      return;
    }
    setSibuk(true);
    try {
      const isian = { text: teks.trim(), assignee_id: pic, due_date: tenggat || null };
      if (lembar.mode === 'baru') {
        const baru = await tambahTindakLanjut(rapatId, tanggal, isian);
        onItems([...items, baru]);
      } else {
        ganti(await ubahTindakLanjut(rapatId, lembar.item.id, isian));
      }
      setLembar(null);
    } catch (err) {
      galat(err, 'Tindak lanjut gagal disimpan.');
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(item: Item): Promise<void> {
    const ok = await dialog.confirm({ title: 'Hapus tindak lanjut?', message: `"${item.text}" dihapus dari notulen.`, confirmLabel: 'Hapus', destructive: true });
    if (!ok) {
      return;
    }
    try {
      await hapusTindakLanjut(rapatId, item.id);
      onItems(items.filter((x) => x.id !== item.id));
      setLembar(null);
    } catch (err) {
      galat(err, 'Tindak lanjut gagal dihapus.');
    }
  }

  async function centang(item: Item, done: boolean): Promise<void> {
    ganti({ ...item, done });
    try {
      ganti(await ubahTindakLanjut(rapatId, item.id, { done }));
    } catch (err) {
      ganti(item);
      galat(err, 'Status tindak lanjut gagal disimpan.');
    }
  }

  async function jadikan(ids: string[], wsId: string | null): Promise<void> {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    setGalatWs(null);
    try {
      if (ids.length === 1 && ids[0]) {
        const hasil = await jadikanTugas(rapatId, ids[0], wsId);
        ganti(hasil.item);
        snackbar.show({ message: hasil.item.task_key ? `Tugas dibuat: ${hasil.item.task_key}` : 'Tugas sudah ada.', variant: 'ok' });
      } else {
        const hasil = await jadikanSemuaTugas(rapatId, tanggal, ids, wsId);
        onNotulen(hasil.notulen);
        const kunci = hasil.notulen.action_items.filter((x) => ids.includes(x.id) && x.task_key).map((x) => x.task_key);
        snackbar.show({ message: `${hasil.created} tugas dibuat${kunci.length ? `: ${kunci.join(', ')}` : ''}`, variant: 'ok' });
      }
      setPilihWs(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 422)) {
        setGalatWs(err.firstValidationError ?? err.message);
        if (!pilihWs && workspaces.length > 0) {
          setPilihWs({ ids });
        }
      } else {
        galat(err, 'Tugas gagal dibuat.');
      }
    } finally {
      setSibuk(false);
    }
  }

  function mulaiJadikan(ids: string[]): void {
    if (workspace) {
      void jadikan(ids, null);
    } else {
      setGalatWs(null);
      setPilihWs({ ids });
    }
  }

  async function ingatkan(): Promise<void> {
    try {
      const hasil = await ingatkanPic(rapatId, tanggal);
      setDiingatkan(true);
      snackbar.show({ message: hasil.message, variant: hasil.reminded.length ? 'ok' : 'info' });
    } catch (err) {
      galat(err, 'Pengingat gagal dikirim.');
    }
  }

  const tanpaTugas = items.filter((x) => !x.task_key && !x.done);
  const picTerbuka = new Set(items.filter((x) => !x.done && x.assignee_id).map((x) => x.assignee_id)).size;

  return (
    <Card style={{ gap: 4 }}>
      <View style={s.baris}>
        <Text variant="h3" style={{ flex: 1 }}>
          Tindak lanjut
        </Text>
        {items.length > 0 ? <Badge tone="neutral">{`${items.length} butir`}</Badge> : null}
      </View>
      {galatWs && !pilihWs ? <Banner tone="bad" message={galatWs} /> : null}
      {items.length === 0 ? <Text variant="meta">Belum ada tindak lanjut.</Text> : null}
      {items.map((item, i) => {
        const milikSaya = item.assignee_id !== null && item.assignee_id === viewerId;
        const bolehCentang = !offline && (bolehKelola || milikSaya);
        const t = ketTenggat(item.due_date, item.done);
        return (
          <View key={item.id} style={[s.item, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
            <Checkbox checked={item.done} onChange={(v) => void centang(item, v)} disabled={!bolehCentang} label={`Selesai: ${item.text}`} />
            <Pressable onPress={tulis ? () => buka(item) : undefined} disabled={!tulis} scaleTo={1} accessibilityRole={tulis ? 'button' : undefined} accessibilityLabel={tulis ? `Ubah ${item.text}` : item.text} style={{ flex: 1, gap: 4 }}>
              <Text variant="label" style={[{ fontSize: 16, lineHeight: 22 }, item.done ? { textDecorationLine: 'line-through', color: colors.muted } : null]}>
                {item.text}
              </Text>
              {item.assignee_id ? (
                <View style={s.baris}>
                  <Avatar name={nama(item.assignee_id)} size="sm" />
                  <Text variant="meta" tone={t?.telat ? 'danger' : 'muted'}>
                    {`${namaDepan(nama(item.assignee_id))}${milikSaya ? ' (Anda)' : ''}${t ? ` · ${t.teks}` : ''}${milikSaya && final && !item.done ? ' · dapat Anda centang' : ''}`}
                  </Text>
                </View>
              ) : (
                <Badge tone="warning">PIC belum dipilih</Badge>
              )}
            </Pressable>
            {item.task_key ? (
              <Tag tone="info">{item.task_key}</Tag>
            ) : item.done ? (
              <Badge tone="success">Selesai</Badge>
            ) : bolehKelola && !offline ? (
              <Button title="Jadikan tugas" size="sm" variant="tonal" onPress={() => mulaiJadikan([item.id])} />
            ) : null}
          </View>
        );
      })}
      {tulis ? <Button title="Tambah tindak lanjut" variant="tonal" icon="plus" disabled={offline} onPress={() => buka(null)} /> : null}
      {bolehKelola && tanpaTugas.length > 1 && !offline ? <Button title="Jadikan semua tugas" variant="outline" icon="list-checks" onPress={() => mulaiJadikan(tanpaTugas.map((x) => x.id))} /> : null}
      {bolehKelola && final && picTerbuka > 0 ? (
        diingatkan ? (
          <Text variant="meta" align="center">
            PIC sudah diingatkan · paling cepat lagi besok
          </Text>
        ) : (
          <Button title={`Ingatkan ${picTerbuka} PIC`} variant="tonal" icon="bell-ring" disabled={offline} onPress={() => void ingatkan()} />
        )
      ) : null}

      <BottomSheet visible={lembar !== null} onClose={() => setLembar(null)} title={lembar?.mode === 'ubah' ? 'Ubah tindak lanjut' : 'Tindak lanjut baru'} scrollable>
        <Text variant="label">Apa yang harus dikerjakan</Text>
        <SheetInput value={teks} onChangeText={setTeks} placeholder="Kirim jadwal servis ke vendor" maxLength={300} accessibilityLabel="Apa yang harus dikerjakan" />
        <Text variant="label">Penanggung jawab</Text>
        <Radio selected={pic === null} label="Belum dipilih" onSelect={() => setPic(null)} />
        {orang.map((o) => (
          <Radio key={o.id} selected={pic === o.id} label={o.id === viewerId ? `${o.nama} (Anda)` : o.nama} onSelect={() => setPic(o.id)} />
        ))}
        <DateInput label="Tenggat (opsional)" value={tenggat} onChange={setTenggat} />
        <Button title={lembar?.mode === 'ubah' ? 'Simpan' : 'Tambah'} loading={sibuk} disabled={teks.trim() === ''} disabledReason="Isi tindak lanjut dulu" onPress={() => void simpan()} />
        {lembar?.mode === 'ubah' ? <Button title="Hapus tindak lanjut" variant="quiet" onPress={() => void hapus(lembar.item)} /> : null}
      </BottomSheet>

      <BottomSheet visible={pilihWs !== null} onClose={() => setPilihWs(null)} title="Jadikan tugas" scrollable>
        <Text variant="meta">
          {pilihWs && pilihWs.ids.length === 1
            ? (() => {
                const it = items.find((x) => x.id === pilihWs.ids[0]);
                return it ? `"${it.text}"${it.assignee_id ? ` · ${namaDepan(nama(it.assignee_id))}` : ''}${it.due_date ? ` · tenggat ${hariSingkat(it.due_date)}` : ''}` : '';
              })()
            : `${pilihWs?.ids.length ?? 0} tindak lanjut dijadikan tugas.`}
        </Text>
        {galatWs ? <Banner tone="bad" message={galatWs} /> : null}
        <Text variant="label">Pilih workspace</Text>
        {workspaces.length === 0 ? <Text variant="meta">Anda tidak punya workspace yang bisa diubah tugasnya.</Text> : null}
        {workspaces.map((w) => (
          <Radio key={w.id} selected={false} label={`${w.key} · ${w.name}`} disabled={sibuk} onSelect={() => pilihWs && void jadikan(pilihWs.ids, w.id)} />
        ))}
      </BottomSheet>
    </Card>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
});
