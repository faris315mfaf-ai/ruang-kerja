/**
 * Form objective (mockup 06 › 26-1…26-4; O4/O5): divisi (Kadiv terkunci ke
 * divisinya; ubah = tidak bisa pindah divisi), kuartal, judul (5–200),
 * deskripsi, pemilik (karyawan aktif/kepala divisi itu), simpan sebagai draf.
 * Galat 422 per field; "Buang perubahan?" saat kembali.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatObjective, daftarOkr, detailObjective, ubahObjective, type DaftarOkr, type DetailObjective, type Divisi } from '@/api/okr';
import { labelKuartal } from '@/features/okr/format';
import { pesanGalat } from '@/features/proyek/tunda';
import { useJagaBuang } from '@/features/proyek/useJagaBuang';
import { useResource } from '@/features/workspace/useResource';
import { BottomSheet, Button, Chip, ErrorState, Field, Input, Loading, LockedState, Radio, Screen, SelectField, SubAppBar, Switch, Text, errorKindFromStatus, useSnackbar } from '@/ui';

interface Sumber {
  divisions: Divisi[];
  people: { id: string; name: string; division_id?: string | null }[];
  quarters: string[];
}

export default function LayarFormObjective(): React.JSX.Element {
  const { id: pid, kuartal: pk } = useLocalSearchParams<{ id?: string; kuartal?: string }>();
  const id = typeof pid === 'string' && pid !== '' ? pid : null;
  const kuartal = typeof pk === 'string' && pk !== '' ? pk : undefined;
  const ubah = useResource<DetailObjective>(id ? `okr-obj:${id}` : null, useCallback(() => detailObjective(id ?? ''), [id]));
  const baru = useResource<DaftarOkr>(id ? null : `okr-buat:${kuartal ?? 'kini'}`, useCallback(() => daftarOkr(kuartal), [kuartal]));
  const r = id ? ubah : baru;
  const judul = id ? 'Ubah objective' : 'Objective baru';

  if (!r.data) {
    return <Screen header={<SubAppBar title={judul} />}>{r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={5} />}</Screen>;
  }
  if (id && ubah.data) {
    const o = ubah.data.objective;
    if (!o.can?.update) {
      return (
        <Screen header={<SubAppBar title={judul} />} contentStyle={{ paddingTop: 24 }}>
          <LockedState reason="Hanya Kepala Divisi atau Direksi yang dapat mengubah objective ini." actionLabel="Kembali" onAction={() => router.back()} />
        </Screen>
      );
    }
    return <Isian judul={judul} sumber={{ divisions: [o.division], people: ubah.data.people, quarters: ubah.data.quarters }} awal={ubah.data} kuartalAwal={o.quarter} onSimpan={() => void ubah.muat()} />;
  }
  const c = baru.data?.create ?? null;
  if (!c) {
    return (
      <Screen header={<SubAppBar title={judul} />} contentStyle={{ paddingTop: 24 }}>
        <LockedState reason="Hanya Kepala Divisi (divisinya) atau Direksi yang dapat membuat objective." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }
  return <Isian judul={judul} sumber={c} awal={null} kuartalAwal={baru.data?.filters.quarter ?? c.quarters[0] ?? ''} />;
}

function Isian({ judul, sumber, awal, kuartalAwal, onSimpan }: { judul: string; sumber: Sumber; awal: DetailObjective | null; kuartalAwal: string; onSimpan?: () => void }): React.JSX.Element {
  const snackbar = useSnackbar();
  const o = awal?.objective ?? null;
  const [divisi, setDivisi] = useState<string>(o?.division.id ?? (sumber.divisions.length === 1 ? (sumber.divisions[0]?.id ?? '') : ''));
  const [kuartal, setKuartal] = useState(kuartalAwal);
  const [title, setTitle] = useState(o?.title ?? '');
  const [desk, setDesk] = useState(o?.description ?? '');
  const [pemilik, setPemilik] = useState<{ id: string; name: string } | null>(o ? o.owner : null);
  const [draf, setDraf] = useState(o?.status === 'draft');
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [pilihOrang, setPilihOrang] = useState(false);
  const berubah = o ? title !== o.title || desk !== (o.description ?? '') || pemilik?.id !== o.owner.id || kuartal !== o.quarter || draf !== (o.status === 'draft') : title !== '' || desk !== '' || pemilik !== null;
  const jaga = useJagaBuang(berubah && !menyimpan, 'Buang perubahan?', 'Objective yang Anda tulis belum disimpan.');

  const orang = useMemo(() => {
    const cocok = sumber.people.filter((p) => !('division_id' in p) || p.division_id === divisi || p.division_id === undefined);
    return cocok.length > 0 ? cocok : sumber.people;
  }, [sumber.people, divisi]);

  const simpan = async (): Promise<void> => {
    const g: Record<string, string> = {};
    if (!o && divisi === '') g.division_id = 'Pilih divisi.';
    if (title.trim().length < 5) g.title = 'Judul minimal 5 karakter.';
    if (!pemilik) g.owner_id = 'Pilih pemilik objective.';
    setGalat(g);
    if (Object.keys(g).length > 0 || !pemilik) return;
    setMenyimpan(true);
    const isian = { quarter: kuartal, title: title.trim(), description: desk.trim() === '' ? null : desk.trim(), owner_id: pemilik.id, status: draf ? ('draft' as const) : ('active' as const) };
    try {
      const h = o ? await ubahObjective(o.id, isian) : await buatObjective({ ...isian, division_id: divisi });
      jaga.izinkanKeluar();
      snackbar.show({ message: h.message, variant: 'ok' });
      onSimpan?.();
      if (o) router.back();
      else router.replace(`/okr/${h.objective.id}` as never);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const b: Record<string, string> = {};
        for (const [f, p] of Object.entries(err.errors)) if (p[0]) b[f] = p[0];
        setGalat(b);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Objective gagal disimpan.'), variant: 'bad' });
      }
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Screen
      header={<SubAppBar title={judul} />}
      footer={
        <>
          <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title={o ? 'Simpan' : 'Buat objective'} icon="check" loading={menyimpan} style={{ flex: 1.4 }} onPress={() => void simpan()} />
        </>
      }
    >
      <Field label="Divisi" required error={galat.division_id || null} hint={o ? 'Divisi tidak bisa diubah.' : sumber.divisions.length === 1 ? 'Divisi yang Anda pimpin.' : undefined}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sumber.divisions.map((v) => (
            <Chip key={v.id} label={v.name} selected={divisi === v.id} disabled={!!o || sumber.divisions.length === 1} onPress={() => { setDivisi(v.id); setPemilik(null); }} />
          ))}
        </View>
      </Field>
      <Field label="Kuartal" required error={galat.quarter || null}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sumber.quarters.map((q) => (
            <Chip key={q} label={labelKuartal(q)} selected={kuartal === q} onPress={() => setKuartal(q)} />
          ))}
        </View>
      </Field>
      <Field label="Objective" required error={galat.title || null} counter={`${title.length}/200`}>
        <Input value={title} onChangeText={setTitle} maxLength={200} multiline invalid={!!galat.title} placeholder="Mis. Migrasi sistem gudang tanpa insiden kritis" accessibilityLabel="Judul objective" />
      </Field>
      <Field label="Deskripsi" hint="Opsional" error={galat.description || null}>
        <Input value={desk} onChangeText={setDesk} multiline maxLength={2000} placeholder="Mengapa objective ini penting?" accessibilityLabel="Deskripsi objective" />
      </Field>
      <Field label="Pemilik (PIC)" required error={galat.owner_id || null}>
        <SelectField value={pemilik?.name ?? ''} placeholder="Pilih pemilik" onPress={() => setPilihOrang(true)} />
      </Field>
      <Switch label="Simpan sebagai draf" value={draf} onValueChange={setDraf} />
      <Text variant="meta">Progres objective = rata-rata berbobot key result-nya, dihitung server.</Text>
      <BottomSheet visible={pilihOrang} onClose={() => setPilihOrang(false)} title="Pemilik objective" showClose scrollable snapPoints={['70%']}>
        <View style={{ gap: 4 }}>
          {orang.map((p) => (
            <Radio key={p.id} label={p.name} selected={pemilik?.id === p.id} onSelect={() => { setPemilik({ id: p.id, name: p.name }); setPilihOrang(false); }} />
          ))}
          {orang.length === 0 ? <Text variant="meta">Tidak ada calon pemilik di divisi ini.</Text> : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
