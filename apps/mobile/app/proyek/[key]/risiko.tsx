/**
 * Risiko proyek (mockup 06 › 13; P12–P15): tab Terbuka (Tinggi → Rendah,
 * pemilik, tugas terkait) dan Teratasi (baca saja); PIC/admin: Tambah, ⋯ Ubah
 * · Tandai teratasi/Buka lagi · Hapus (+ Urungkan). Form di sheet: judul,
 * level, pemilik (anggota workspace), tugas terkait.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatRisiko, hapusRisiko, statusRisiko, ubahRisiko, type LevelRisiko, type Risiko } from '@/api/proyek';
import { ambilAnggotaWorkspace, type AnggotaBaris } from '@/api/workspace';
import { hariTanggal, LABEL_LEVEL, nadaLevel } from '@/features/proyek/format';
import { bukaTugas } from '@/features/proyek/komponen';
import { pesanGalat, useTundaKirim } from '@/features/proyek/tunda';
import { useProyek } from '@/features/proyek/useProyek';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import {
  Avatar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Loading,
  Radio,
  Screen,
  SegmentedTabs,
  SelectField,
  SheetAction,
  SubAppBar,
  Text,
  errorKindFromStatus,
  useDialog,
  useSnackbar,
} from '@/ui';

type Tab = 'open' | 'resolved';
const LEVEL: LevelRisiko[] = ['high', 'medium', 'low'];

interface Draf {
  id: string | null;
  title: string;
  level: LevelRisiko | null;
  owner: { id: string; name: string } | null;
  task: { id: string; code: string; title: string } | null;
  status: 'open' | 'resolved';
}

export default function LayarRisiko(): React.JSX.Element {
  const { key: param } = useLocalSearchParams<{ key: string }>();
  const key = typeof param === 'string' ? param : '';
  const r = useProyek(key);
  const { menarik, tarik } = useTarik(r.muat);
  const snackbar = useSnackbar();
  const dialog = useDialog();
  const tunda = useTundaKirim();
  const [tab, setTab] = useState<Tab>('open');
  const [menu, setMenu] = useState<Risiko | null>(null);
  const [draf, setDraf] = useState<Draf | null>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [pemilihPemilik, setPemilihPemilik] = useState(false);
  const [pemilihTugas, setPemilihTugas] = useState(false);
  const [anggota, setAnggota] = useState<AnggotaBaris[] | null>(null);
  const [tersembunyi, setTersembunyi] = useState<Set<string>>(new Set());
  const d = r.data;
  const pk = d?.project.key ?? key;
  const boleh = (d?.can.manage_risks ?? false) && !r.offline;
  const semua = (d?.risks ?? []).filter((x) => !tersembunyi.has(x.id));
  const daftar = semua.filter((x) => x.status === tab);

  const bukaForm = (x: Risiko | null): void => {
    setGalat({});
    setDraf(
      x
        ? { id: x.id, title: x.title, level: x.level, owner: x.owner ? { id: x.owner.id, name: x.owner.name } : null, task: x.task ? { id: x.task.id, code: x.task.code, title: x.task.title } : null, status: x.status }
        : { id: null, title: '', level: null, owner: null, task: null, status: 'open' },
    );
    if (anggota === null) {
      ambilAnggotaWorkspace(pk)
        .then((a) => setAnggota(a.anggota))
        .catch(() => setAnggota([]));
    }
  };

  const simpan = async (): Promise<void> => {
    if (!draf) return;
    const g: Record<string, string> = {};
    if (draf.title.trim() === '') g.title = 'Judul risiko wajib diisi.';
    if (!draf.level) g.level = 'Pilih level risiko.';
    setGalat(g);
    if (Object.keys(g).length > 0 || !draf.level) return;
    setMenyimpan(true);
    const isian = { title: draf.title.trim(), level: draf.level, owner_id: draf.owner?.id ?? null, task_id: draf.task?.id ?? null, status: draf.status };
    try {
      const hasil = draf.id ? await ubahRisiko(pk, draf.id, isian) : await buatRisiko(pk, isian);
      snackbar.show({ message: hasil.message, variant: 'ok' });
      setDraf(null);
      void r.muat();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const b: Record<string, string> = {};
        for (const [f, p] of Object.entries(err.errors)) if (p[0]) b[f] = p[0];
        setGalat(b);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Risiko gagal disimpan.'), variant: 'bad' });
      }
    } finally {
      setMenyimpan(false);
    }
  };

  const ubahStatus = async (x: Risiko): Promise<void> => {
    try {
      const hasil = await statusRisiko(pk, x.id, x.status === 'open' ? 'resolved' : 'open');
      snackbar.show({ message: hasil.message, variant: 'ok' });
      void r.muat();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Status risiko gagal diubah.'), variant: 'bad' });
    }
  };

  const hapus = async (x: Risiko): Promise<void> => {
    const ok = await dialog.confirm({ title: 'Hapus risiko?', message: `"${x.title}" dihapus dari proyek.`, confirmLabel: 'Hapus', destructive: true });
    if (!ok) return;
    setTersembunyi((s) => new Set(s).add(x.id));
    tunda({
      pesan: 'Risiko dihapus.',
      kirim: () => hapusRisiko(pk, x.id),
      pulihkan: () => setTersembunyi((s) => { const b = new Set(s); b.delete(x.id); return b; }),
      selesai: () => void r.muat(),
    });
  };

  return (
    <Screen header={<SubAppBar title={`Risiko${d ? ` · ${d.project.key}` : ''}`} actions={boleh ? [{ icon: 'plus', label: 'Tambah risiko', onPress: () => bukaForm(null) }] : []} />} refreshing={menarik} onRefresh={tarik}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="risiko" /> : null}
      {!d ? (
        r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={4} label="Memuat risiko…" />
      ) : (
        <>
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'open', label: 'Terbuka', badge: semua.filter((x) => x.status === 'open').length },
              { value: 'resolved', label: 'Teratasi', badge: semua.filter((x) => x.status === 'resolved').length },
            ]}
          />
          {!d.can.manage_risks ? <Banner tone="neutral" icon="eye" message="Hanya PIC dan admin workspace yang menambah atau mengubah risiko." /> : null}
          {daftar.length === 0 ? (
            <EmptyState
              icon="shield-check"
              title={tab === 'open' ? 'Tidak ada risiko terbuka' : 'Belum ada risiko teratasi'}
              actionLabel={tab === 'open' && boleh ? 'Tambah risiko' : undefined}
              onAction={() => bukaForm(null)}
            />
          ) : (
            daftar.map((x) => (
              <Card key={x.id} variant="tight" style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Badge tone={x.status === 'resolved' ? 'neutral' : nadaLevel(x.level)}>{LABEL_LEVEL[x.level]}</Badge>
                    <Text variant="title">{x.title}</Text>
                  </View>
                  {boleh ? <IconButton icon="ellipsis-vertical" label={`Aksi risiko ${x.title}`} variant="ghost" onPress={() => setMenu(x)} /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {x.owner ? <Avatar name={x.owner.name} size="sm" /> : null}
                  <Text variant="meta" style={{ fontSize: 14 }}>
                    {x.owner?.name ?? 'Tanpa pemilik'}
                  </Text>
                  {x.task ? <Chip label={x.task.code} icon="link" variant="tonal" onPress={() => x.task && bukaTugas(x.task.id)} /> : null}
                </View>
                {x.resolved_at ? <Text variant="meta">{`Teratasi ${hariTanggal(x.resolved_at.slice(0, 10))}`}</Text> : null}
              </Card>
            ))
          )}
        </>
      )}

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.title}>
        {menu ? (
          <>
            <SheetAction icon="pencil" label="Ubah" onPress={() => { const x = menu; setMenu(null); bukaForm(x); }} />
            <SheetAction icon={menu.status === 'open' ? 'shield-check' : 'rotate-ccw'} label={menu.status === 'open' ? 'Tandai teratasi' : 'Buka lagi'} onPress={() => { const x = menu; setMenu(null); void ubahStatus(x); }} />
            <SheetAction icon="trash-2" label="Hapus" tone="danger" onPress={() => { const x = menu; setMenu(null); void hapus(x); }} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={draf !== null && !pemilihPemilik && !pemilihTugas} onClose={() => setDraf(null)} title={draf?.id ? 'Ubah risiko' : 'Risiko baru'} showClose scrollable>
        {draf ? (
          <View style={{ gap: 16 }}>
            <Field label="Judul risiko" required error={galat.title || null} counter={`${draf.title.length}/200`}>
              <Input value={draf.title} onChangeText={(v) => setDraf({ ...draf, title: v })} maxLength={200} invalid={!!galat.title} placeholder="Mis. Kontrak vendor percetakan belum ditandatangani" accessibilityLabel="Judul risiko" />
            </Field>
            <Field label="Level" required error={galat.level || null}>
              <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
                {LEVEL.map((l) => (
                  <Chip key={l} label={LABEL_LEVEL[l]} selected={draf.level === l} onPress={() => setDraf({ ...draf, level: l })} />
                ))}
              </View>
            </Field>
            <Field label="Pemilik" hint="Anggota workspace" error={galat.owner_id || null}>
              <SelectField value={draf.owner?.name ?? ''} placeholder="Pilih pemilik (opsional)" onPress={() => setPemilihPemilik(true)} />
            </Field>
            <Field label="Tugas terkait" error={galat.task_id || null}>
              <SelectField value={draf.task ? `${draf.task.code} · ${draf.task.title}` : ''} placeholder="Pilih tugas (opsional)" onPress={() => setPemilihTugas(true)} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => setDraf(null)} />
              <Button title="Simpan" icon="check" loading={menyimpan} style={{ flex: 1.4 }} onPress={() => void simpan()} />
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={pemilihPemilik} onClose={() => setPemilihPemilik(false)} title="Pemilik risiko" showClose scrollable snapPoints={['70%']}>
        {anggota === null ? (
          <Loading rows={4} />
        ) : (
          <View style={{ gap: 4 }}>
            <Radio label="Tanpa pemilik" selected={!draf?.owner} onSelect={() => { if (draf) setDraf({ ...draf, owner: null }); setPemilihPemilik(false); }} />
            {anggota.map((a) => (
              <Radio key={a.id} label={a.name} description={a.role_label} selected={draf?.owner?.id === a.id} onSelect={() => { if (draf) setDraf({ ...draf, owner: { id: a.id, name: a.name } }); setPemilihPemilik(false); }} />
            ))}
            {anggota.length === 0 ? <Text variant="meta">Daftar anggota tidak dapat dimuat.</Text> : null}
          </View>
        )}
      </BottomSheet>

      <BottomSheet visible={pemilihTugas} onClose={() => setPemilihTugas(false)} title="Tugas terkait" showClose scrollable snapPoints={['70%']}>
        <View style={{ gap: 4 }}>
          <Radio label="Tanpa tugas" selected={!draf?.task} onSelect={() => { if (draf) setDraf({ ...draf, task: null }); setPemilihTugas(false); }} />
          {(d?.task_options ?? []).slice(0, 150).map((t) => (
            <Radio key={t.id} label={`${t.code} · ${t.title}`} selected={draf?.task?.id === t.id} onSelect={() => { if (draf) setDraf({ ...draf, task: { id: t.id, code: t.code, title: t.title } }); setPemilihTugas(false); }} />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
