/**
 * Tugas baru — form lengkap layar penuh (mockup 05-tugas-workspace/13).
 * Parameter: `workspace` (id/key), `parent_id` (jadikan sub-tugas), `judul`.
 * Deskripsi teks polos; checklist awal dikirim sebagai butir setelah tugas dibuat.
 */
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatTugasBaru, detailTugasPenuh, type BarisTugas } from '@/api/tugas';
import { PriorityBars, StatusRing, UbinWorkspace } from '@/features/tugas/ikon';
import { PropChip } from '@/features/tugas/PropChip';
import { SheetLabel, SheetOrang, SheetPrioritas, SheetStatus, SheetTenggat, SheetWorkspace } from '@/features/tugas/Pilihan';
import { parseEstimasi, statusBawaan, useBuatTugas, type IsiBawaan } from '@/features/tugas/useBuatTugas';
import { LABEL_PRIORITAS, galatPerField, hariSingkat, pesanGalat, ringkasLabel } from '@/features/tugas/util';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme } from '@/theme';
import { Avatar, Banner, Button, DateInput, Field, Icon, IconButton, Input, Pressable, Screen, SubAppBar, Text, tanggal, useDialog, useSnackbar } from '@/ui';

type Pilih = 'status' | 'prioritas' | 'orang' | 'label' | 'workspace' | 'tenggat' | null;

/** Pilihan yang dibawa dari sheet "Tugas baru" (parameter kosong = tidak dibawa). */
function isiDariParam(p: { status?: string; prioritas?: string; pj?: string; label?: string; tenggat?: string }): IsiBawaan | undefined {
  const daftar = (v?: string): string[] | undefined => (typeof v === 'string' && v !== '' ? v.split(',').filter((x) => x !== '') : undefined);
  const prioritas = typeof p.prioritas === 'string' && /^[0-4]$/.test(p.prioritas) ? Number(p.prioritas) : undefined;
  const isi: IsiBawaan = {
    statusId: typeof p.status === 'string' && p.status !== '' ? p.status : undefined,
    priority: prioritas,
    assignees: typeof p.pj === 'string' ? (daftar(p.pj) ?? []) : undefined,
    labels: daftar(p.label),
    due: typeof p.tenggat === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.tenggat) ? p.tenggat : undefined,
  };
  return Object.values(isi).some((v) => v !== undefined) ? isi : undefined;
}

export default function LayarTugasBaru(): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useSession();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ workspace?: string; parent_id?: string; judul?: string; status?: string; prioritas?: string; pj?: string; label?: string; tenggat?: string }>();
  const parentId = typeof params.parent_id === 'string' && params.parent_id !== '' ? params.parent_id : undefined;
  const f = useBuatTugas({
    workspace: typeof params.workspace === 'string' && params.workspace !== '' ? params.workspace : undefined,
    judul: typeof params.judul === 'string' ? params.judul : undefined,
    isi: isiDariParam(params),
  });
  const { draf } = f;
  const [pilih, setPilih] = useState<Pilih>(null);
  const [butirBaru, setButirBaru] = useState('');
  const [induk, setInduk] = useState<{ key: string; title: string; workspaceId: string } | null>(null);
  const [galatInduk, setGalatInduk] = useState<string | null>(null);
  const [galatSub, setGalatSub] = useState<Record<string, string>>({});
  const [mengirimSub, setMengirimSub] = useState(false);
  const lewati = useRef(false);
  const hariIni = tanggal.hariIniIso();

  // Sub-tugas: ambil induk (judul + workspace) lalu kunci ke workspace itu.
  useEffect(() => {
    if (!parentId) {
      return;
    }
    let batal = false;
    void detailTugasPenuh(parentId)
      .then((t) => {
        if (!batal) {
          setInduk({ key: t.key, title: t.title, workspaceId: t.workspace.id });
          const w = f.kelompok.flatMap((g) => g.items).find((x) => x.id === t.workspace.id);
          if (w) {
            f.pilihWorkspace(w);
          }
        }
      })
      .catch((e: unknown) => {
        if (!batal) {
          setGalatInduk(pesanGalat(e, 'Tugas induk tidak dapat dimuat.'));
        }
      });
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dijalankan sekali per parent & saat daftar workspace siap
  }, [parentId, f.kelompok.length]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (lewati.current || !f.adaPerubahan) {
        return;
      }
      e.preventDefault();
      void dialog.confirm({ title: 'Buang perubahan?', message: 'Tugas yang Anda tulis belum dibuat.', confirmLabel: 'Buang', destructive: true }).then((ok) => {
        if (ok) {
          lewati.current = true;
          navigation.dispatch(e.data.action);
        }
      });
    });
  }, [navigation, f.adaPerubahan, dialog]);

  // Tanpa pilihan: kolom yang dipakai server (Todo), bukan kolom pertama (Backlog).
  const statusDipilih = f.konteks?.statuses.find((s) => s.id === (draf.statusId ?? statusBawaan(f.konteks))) ?? null;
  const namaOrang = (id: string): string => (id === user?.id ? 'Saya' : (f.anggota.find((a) => a.id === id)?.name ?? 'Orang'));

  // Papan ketik isian menutupi lembar pemilih.
  const buka = (p: Exclude<Pilih, null>): void => {
    Keyboard.dismiss();
    setPilih(p);
  };

  async function buat(): Promise<void> {
    if (parentId) {
      // Sub-tugas: lewat POST /tugas dengan parent_id (workspace induk).
      const judul = draf.title.trim();
      const g: Record<string, string> = {};
      if (judul === '') {
        g.title = 'Judul tugas wajib diisi.';
      }
      if (!draf.workspace) {
        g.workspace = 'Workspace induk belum siap.';
      }
      setGalatSub(g);
      if (Object.keys(g).length > 0 || !draf.workspace) {
        return;
      }
      setMengirimSub(true);
      try {
        const est = parseEstimasi(draf.estimate);
        const t = await buatTugasBaru({
          workspace_id: draf.workspace.id,
          title: judul,
          description: draf.description.trim() || undefined,
          assignee_ids: draf.assignees.length > 0 ? draf.assignees : undefined,
          due_date: draf.due ?? undefined,
          priority: draf.priority,
          status_id: statusDipilih?.id ?? undefined,
          label_ids: draf.labels.length > 0 ? draf.labels : undefined,
          start_date: draf.start ?? undefined,
          estimate_hours: est !== null && !Number.isNaN(est) ? est : undefined,
          parent_id: parentId,
        });
        lewati.current = true;
        snackbar.show({ message: `${t.key} dibuat`, variant: 'ok' });
        router.back();
      } catch (err) {
        setGalatSub({ ...galatPerField(err, { due_date: 'due' }), umum: err instanceof ApiError && Object.keys(err.errors).length === 0 ? err.message : '' });
      } finally {
        setMengirimSub(false);
      }
      return;
    }
    const t = await f.kirim();
    if (t) {
      lewati.current = true;
      snackbar.show({ message: `${t.key} dibuat`, variant: 'ok' });
      router.replace(`/tugas/${t.id}`);
    }
  }

  const g = parentId ? galatSub : f.galat;
  const umum = parentId ? galatSub.umum : f.galatUmum;
  const sibuk = f.mengirim || mengirimSub;
  const tambahButir = (): void => {
    const t = butirBaru.trim();
    if (t !== '') {
      f.ubah({ checklist: [...draf.checklist, t.slice(0, 200)] });
      setButirBaru('');
    }
  };
  const sub: Pick<BarisTugas, 'id'> | null = null;
  void sub;

  return (
    <Screen
      header={<SubAppBar title={induk ? `Sub-tugas dari ${induk.key}` : 'Tugas baru'} />}
      contentStyle={{ gap: 16, paddingBottom: 24 }}
      footer={
        <>
          <View style={{ flex: 1 }}>
            <Button title="Batal" variant="outline" onPress={() => router.back()} />
          </View>
          <View style={{ flex: 1.5 }}>
            <Button title="Buat tugas" icon="plus" onPress={() => void buat()} loading={sibuk} loadingTitle="Membuat…" disabled={f.memuat} />
          </View>
        </>
      }
    >
      {galatInduk ? <Banner tone="bad" message={galatInduk} /> : null}
      {induk ? <Banner tone="info" icon="corner-down-right" message={`Menjadi sub-tugas dari ${induk.key} · ${induk.title}`} /> : null}
      {umum ? <Banner tone="bad" message={umum} /> : null}
      {f.galatMuat ? <Banner tone="bad" message={f.galatMuat} actionLabel="Coba lagi" onAction={f.muatUlang} /> : null}
      {f.galatKonteks ? <Banner tone="bad" message={f.galatKonteks} actionLabel="Coba lagi" onAction={f.muatUlangKonteks} /> : null}

      <Field label="Workspace" error={g.workspace} hint={f.memuatKonteks ? 'Memuat kolom, label, dan anggota…' : undefined}>
        <Pressable
          onPress={() => {
            if (!induk) {
              Keyboard.dismiss();
              setPilih('workspace');
            }
          }}
          scaleTo={1}
          accessibilityRole="button"
          accessibilityLabel={`Workspace: ${draf.workspace?.name ?? 'belum dipilih'}`}
          accessibilityState={{ disabled: induk !== null }}
          style={[s.ws, { borderColor: colors.borderStrong, backgroundColor: induk ? colors.surface2 : colors.surface }]}
        >
          {draf.workspace ? <UbinWorkspace nama={draf.workspace.name} jenis={draf.workspace.type} size={32} /> : null}
          <Text variant="body" weight={700} style={{ flex: 1 }} numberOfLines={1} tone={draf.workspace ? 'text' : 'subtle'}>
            {draf.workspace ? (draf.workspace.type === 'personal' ? 'Pribadi' : draf.workspace.name) : f.memuat ? 'Memuat…' : 'Pilih workspace'}
          </Text>
          <Icon name={induk ? 'lock' : 'chevron-down'} size={20} color={colors.muted} />
        </Pressable>
      </Field>

      <Field label="Judul" required error={g.title} hint="Maks. 255 karakter" counter={`${draf.title.length}/255`}>
        <Input value={draf.title} onChangeText={(v) => f.ubah({ title: v })} placeholder="Judul tugas" maxLength={300} invalid={Boolean(g.title)} accessibilityLabel="Judul tugas" returnKeyType="next" />
      </Field>

      <Field label="Deskripsi" hint="Teks polos. Tanda dan sebutan @orang dibuat di komentar.">
        <Input value={draf.description} onChangeText={(v) => f.ubah({ description: v })} placeholder="Tambahkan detail pekerjaan" multiline maxLength={20000} accessibilityLabel="Deskripsi tugas" />
      </Field>

      <View style={s.chips}>
        <PropChip
          leading={statusDipilih ? <StatusRing kategori={statusDipilih.category} size={22} /> : undefined}
          label={statusDipilih?.name ?? 'Status'}
          aksesLabel={`Status: ${statusDipilih?.name ?? 'belum dimuat'}`}
          onPress={() => buka('status')}
        />
        <PropChip
          leading={draf.priority === 0 ? <Icon name="minus" size={18} /> : <PriorityBars nilai={draf.priority} size={20} />}
          label={draf.priority === 0 ? 'Prioritas' : (LABEL_PRIORITAS[draf.priority] ?? '')}
          aksesLabel={`Prioritas: ${LABEL_PRIORITAS[draf.priority] ?? ''}`}
          putus={draf.priority === 0}
          onPress={() => buka('prioritas')}
        />
        <PropChip
          leading={draf.assignees.length > 0 ? <Avatar name={namaOrang(draf.assignees[0] as string)} size="sm" /> : <Icon name="user" size={20} />}
          label={draf.assignees.length === 0 ? 'Penanggung jawab' : draf.assignees.map(namaOrang).join(', ')}
          aksesLabel={`Penanggung jawab: ${draf.assignees.length === 0 ? 'belum ada' : draf.assignees.map(namaOrang).join(', ')}`}
          putus={draf.assignees.length === 0}
          onPress={() => buka('orang')}
        />
        <PropChip
          leading={<Icon name="tag" size={20} color={draf.labels.length > 0 ? colors.link : colors.text} />}
          label={ringkasLabel(draf.labels, f.konteks?.labels ?? []).teks}
          aksesLabel={ringkasLabel(draf.labels, f.konteks?.labels ?? []).akses}
          aktif={draf.labels.length > 0}
          putus={draf.labels.length === 0}
          onPress={() => setPilih('label')}
        />
      </View>
      {g.assignees ? <Text variant="meta" tone="danger">{g.assignees}</Text> : null}

      <DateInput label="Mulai" value={draf.start ?? ''} onChange={(v) => f.ubah({ start: v || null })} max={draf.due ?? undefined} error={g.start} />
      <DateInput label="Tenggat" value={draf.due ?? ''} onChange={(v) => f.ubah({ due: v || null })} min={draf.start ?? undefined} error={g.due} />
      <Pressable onPress={() => setPilih('tenggat')} accessibilityRole="button" accessibilityLabel="Tenggat cepat: Hari ini, Besok, Pekan depan" scaleTo={1} style={{ alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' }}>
        <Text variant="label" tone="link">
          Tenggat cepat: Hari ini · Besok · Pekan depan
        </Text>
      </Pressable>

      <Field label="Estimasi" error={g.estimate} hint="Angka desimal pakai koma, mis. 1,5">
        <Input value={draf.estimate} onChangeText={(v) => f.ubah({ estimate: v })} placeholder="0" suffix="jam" keyboardType="decimal-pad" invalid={Boolean(g.estimate)} accessibilityLabel="Estimasi jam" />
      </Field>

      {!parentId ? (
        <View style={{ gap: 8 }}>
          <Text variant="overline" tone="muted">
            CHECKLIST AWAL
          </Text>
          {draf.checklist.map((b, i) => (
            <View key={`${b}-${i}`} style={[s.butir, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Icon name="square" size={20} color={colors.subtle} />
              <Text variant="body" style={{ flex: 1 }}>
                {b}
              </Text>
              <IconButton icon="x" label={`Hapus butir ${b}`} variant="ghost" size={40} onPress={() => f.ubah({ checklist: draf.checklist.filter((_, j) => j !== i) })} />
            </View>
          ))}
          <Input
            value={butirBaru}
            onChangeText={setButirBaru}
            placeholder="Tambah butir checklist"
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={tambahButir}
            accessibilityLabel="Butir checklist baru"
            right={<IconButton icon="plus" label="Tambah butir" variant="ghost" size={40} onPress={tambahButir} disabled={butirBaru.trim() === ''} />}
          />
          <Text variant="meta">Lampiran ditambahkan dari detail tugas setelah dibuat.</Text>
        </View>
      ) : null}

      <SheetStatus visible={pilih === 'status'} onClose={() => setPilih(null)} judul="Status awal" statuses={f.konteks?.statuses ?? []} nilai={statusDipilih?.id ?? null} onPilih={(id) => f.ubah({ statusId: id })} />
      <SheetPrioritas visible={pilih === 'prioritas'} onClose={() => setPilih(null)} nilai={draf.priority} onPilih={(n) => f.ubah({ priority: n })} />
      <SheetOrang visible={pilih === 'orang'} onClose={() => setPilih(null)} orang={f.anggota} terpilih={draf.assignees} idSaya={user?.id} memuat={f.memuatKonteks} onSimpan={(ids) => f.ubah({ assignees: ids })} />
      <SheetLabel visible={pilih === 'label'} onClose={() => setPilih(null)} label={f.konteks?.labels ?? []} memuat={f.konteks === null} terpilih={draf.labels} onSimpan={(ids) => f.ubah({ labels: ids })} />
      <SheetTenggat visible={pilih === 'tenggat'} onClose={() => setPilih(null)} nilai={draf.due} hariIni={hariIni} min={draf.start ?? undefined} onPilih={(iso) => f.ubah({ due: iso })} />
      <SheetWorkspace
        visible={pilih === 'workspace'}
        onClose={() => setPilih(null)}
        kelompok={f.kelompok}
        memuat={f.memuat}
        nilai={draf.workspace?.id ?? null}
        onPilih={f.pilihWorkspace}
        onTerkunci={(_, alasan) => snackbar.show({ message: alasan, variant: 'warn' })}
      />
      <Text variant="meta" style={{ display: 'none' }}>
        {hariSingkat(hariIni)}
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  ws: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  butir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: radius.lg, borderWidth: 1, paddingLeft: 14, paddingRight: 4 },
});
