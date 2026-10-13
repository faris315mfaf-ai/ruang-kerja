/**
 * Form key result tambah/ubah (mockup 06 › 26-5…26-6; O7/O8): judul (5–160),
 * satuan (Angka · Persen · Rupiah · Hari, label satuan untuk Angka), nilai
 * awal/target/saat ini (target < awal = "makin kecil makin baik", target =
 * awal ditolak), bobot 1–100, pemilik. Galat 422 per field.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { detailObjective, tambahKr, ubahKr, type DetailObjective, type KeyResult, type SatuanKr } from '@/api/okr';
import { bacaAngka, LABEL_SATUAN, tulisAngka } from '@/features/okr/format';
import { pesanGalat } from '@/features/proyek/tunda';
import { useJagaBuang } from '@/features/proyek/useJagaBuang';
import { useResource } from '@/features/workspace/useResource';
import { BottomSheet, Button, ErrorState, Field, Input, Loading, LockedState, Radio, Screen, SegmentedTabs, SelectField, SubAppBar, Text, errorKindFromStatus, useSnackbar } from '@/ui';

const SATUAN: SatuanKr[] = ['number', 'percent', 'currency', 'days'];

export default function LayarFormKr(): React.JSX.Element {
  const { objective: po, id: pid } = useLocalSearchParams<{ objective: string; id?: string }>();
  const oid = typeof po === 'string' ? po : '';
  const id = typeof pid === 'string' && pid !== '' ? pid : null;
  const r = useResource<DetailObjective>(oid ? `okr-obj:${oid}` : null, useCallback(() => detailObjective(oid), [oid]));
  const judul = id ? 'Ubah key result' : 'Key result baru';
  if (!r.data) {
    return <Screen header={<SubAppBar title={judul} />}>{r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={5} />}</Screen>;
  }
  const kr = id ? ((r.data.objective.key_results ?? []).find((k) => k.id === id) ?? null) : null;
  const boleh = id ? (kr?.can?.update ?? false) : (r.data.objective.can?.add_key_result ?? false);
  if (!boleh || r.data.objective.status === 'closed') {
    return (
      <Screen header={<SubAppBar title={judul} />} contentStyle={{ paddingTop: 24 }}>
        <LockedState reason={r.data.objective.status === 'closed' ? 'Objective sudah ditutup dan hanya bisa dibaca.' : 'Hanya pemilik objective/key result atau Kepala Divisi yang dapat mengubah key result.'} actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }
  return <Isian judul={judul} d={r.data} kr={kr} onSimpan={() => void r.muat()} />;
}

function Isian({ judul, d, kr, onSimpan }: { judul: string; d: DetailObjective; kr: KeyResult | null; onSimpan: () => void }): React.JSX.Element {
  const snackbar = useSnackbar();
  const [title, setTitle] = useState(kr?.title ?? '');
  const [unit, setUnit] = useState<SatuanKr>(kr?.unit ?? 'number');
  const [unitLabel, setUnitLabel] = useState(kr?.unit_label ?? '');
  const [awal, setAwal] = useState(tulisAngka(kr?.start_value ?? 0));
  const [target, setTarget] = useState(kr ? tulisAngka(kr.target_value) : '');
  const [kini, setKini] = useState(kr ? tulisAngka(kr.current_value) : '');
  const [bobot, setBobot] = useState(String(kr?.weight ?? 1));
  const [pemilik, setPemilik] = useState<{ id: string; name: string } | null>(kr?.owner ?? null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [pilih, setPilih] = useState(false);
  const berubah = kr ? title !== kr.title || unit !== kr.unit || awal !== tulisAngka(kr.start_value) || target !== tulisAngka(kr.target_value) || kini !== tulisAngka(kr.current_value) || bobot !== String(kr.weight) || pemilik?.id !== kr.owner.id : title !== '' || target !== '';
  const jaga = useJagaBuang(berubah && !menyimpan, 'Buang perubahan?', 'Key result yang Anda tulis belum disimpan.');
  const vAwal = bacaAngka(awal);
  const vTarget = bacaAngka(target);
  const makinKecil = vAwal !== null && vTarget !== null && vTarget < vAwal;

  const simpan = async (): Promise<void> => {
    const g: Record<string, string> = {};
    const vKini = kini.trim() === '' ? vAwal : bacaAngka(kini);
    const vBobot = Number(bobot);
    if (title.trim().length < 5) g.title = 'Judul minimal 5 karakter.';
    if (vAwal === null) g.start_value = 'Isi nilai awal dengan angka.';
    if (vTarget === null) g.target_value = 'Isi target dengan angka.';
    else if (vAwal !== null && vTarget === vAwal) g.target_value = 'Target tidak boleh sama dengan nilai awal.';
    if (vKini === null) g.current_value = 'Isi nilai saat ini dengan angka.';
    if (unit === 'percent') for (const [k, v] of [['start_value', vAwal], ['target_value', vTarget], ['current_value', vKini]] as const) if (v !== null && (v < 0 || v > 100)) g[k] = 'Persen harus 0–100.';
    if (!Number.isInteger(vBobot) || vBobot < 1 || vBobot > 100) g.weight = 'Bobot bilangan bulat 1–100.';
    if (!pemilik) g.owner_id = 'Pilih pemilik key result.';
    setGalat(g);
    if (Object.keys(g).length > 0 || vAwal === null || vTarget === null || vKini === null || !pemilik) return;
    setMenyimpan(true);
    const isian = { title: title.trim(), unit, unit_label: unit === 'number' && unitLabel.trim() !== '' ? unitLabel.trim() : null, start_value: vAwal, target_value: vTarget, current_value: vKini, weight: vBobot, owner_id: pemilik.id };
    try {
      const h = kr ? await ubahKr(kr.id, isian) : await tambahKr(d.objective.id, isian);
      jaga.izinkanKeluar();
      snackbar.show({ message: h.message, variant: 'ok' });
      onSimpan();
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const b: Record<string, string> = {};
        for (const [f, p] of Object.entries(err.errors)) if (p[0]) b[f] = p[0];
        setGalat(b);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Key result gagal disimpan.'), variant: 'bad' });
      }
    } finally {
      setMenyimpan(false);
    }
  };

  const angkaInput = (label: string, nilai: string, set: (v: string) => void, kunci: string, hint?: string): React.JSX.Element => (
    <Field label={label} required error={galat[kunci] || null} hint={hint}>
      <Input value={nilai} onChangeText={set} keyboardType="decimal-pad" inputMode="decimal" invalid={!!galat[kunci]} suffix={unit === 'percent' ? '%' : unit === 'days' ? 'hari' : unit === 'currency' ? 'Rp' : undefined} accessibilityLabel={label} />
    </Field>
  );

  return (
    <Screen
      header={<SubAppBar title={judul} />}
      footer={
        <>
          <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button title="Simpan" icon="check" loading={menyimpan} style={{ flex: 1.4 }} onPress={() => void simpan()} />
        </>
      }
    >
      <Text variant="meta" style={{ fontSize: 15 }} numberOfLines={2}>
        {d.objective.title}
      </Text>
      <Field label="Key result" required error={galat.title || null} counter={`${title.length}/160`}>
        <Input value={title} onChangeText={setTitle} maxLength={160} invalid={!!galat.title} placeholder="Mis. Skenario UAT lulus" accessibilityLabel="Judul key result" />
      </Field>
      <Field label="Satuan" required error={galat.unit || null}>
        <SegmentedTabs<SatuanKr> value={unit} onChange={setUnit} options={SATUAN.map((s) => ({ value: s, label: LABEL_SATUAN[s] }))} />
      </Field>
      {unit === 'number' ? (
        <Field label="Label satuan" hint="Opsional, mis. skenario, bug, orang" error={galat.unit_label || null}>
          <Input value={unitLabel} onChangeText={setUnitLabel} maxLength={20} accessibilityLabel="Label satuan" />
        </Field>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>{angkaInput('Nilai awal', awal, setAwal, 'start_value')}</View>
        <View style={{ flex: 1 }}>{angkaInput('Target', target, setTarget, 'target_value')}</View>
      </View>
      {makinKecil ? <Text variant="meta" tone="info">Target lebih kecil dari awal: makin kecil makin baik.</Text> : null}
      {angkaInput('Nilai saat ini', kini, setKini, 'current_value', kr ? 'Perubahan rutin sebaiknya lewat Check-in.' : 'Kosong = sama dengan nilai awal.')}
      <Field label="Bobot" required error={galat.weight || null} hint="1–100; dipakai untuk rata-rata berbobot objective">
        <Input value={bobot} onChangeText={setBobot} keyboardType="number-pad" inputMode="numeric" maxLength={3} invalid={!!galat.weight} accessibilityLabel="Bobot" />
      </Field>
      <Field label="Pemilik" required error={galat.owner_id || null}>
        <SelectField value={pemilik?.name ?? ''} placeholder="Pilih pemilik" onPress={() => setPilih(true)} />
      </Field>
      <BottomSheet visible={pilih} onClose={() => setPilih(false)} title="Pemilik key result" showClose scrollable snapPoints={['70%']}>
        <View style={{ gap: 4 }}>
          {d.people.map((p) => (
            <Radio key={p.id} label={p.name} selected={pemilik?.id === p.id} onSelect={() => { setPemilik(p); setPilih(false); }} />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
