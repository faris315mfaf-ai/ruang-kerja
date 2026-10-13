/**
 * Workspace baru (mockup 05 › 15-8): jenis Tim/Proyek, nama, kode (prefiks
 * tugas, `^[A-Z][A-Z0-9]{1,9}$`), visibilitas, tim tertaut, dan "dari template"
 * bila fitur Otomasi aktif. POST /workspace. Layar penuh (bukan sheet) supaya
 * papan ketik tidak menutup isian.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { ambilTemplatWorkspace, buatWorkspace, type DaftarWorkspace, type TemplatWorkspace } from '@/api/workspace';
import { GalatMuat } from '@/features/workspace/bagian';
import { hapusCache, useResource } from '@/features/workspace/useResource';
import { ambilDaftarWorkspace } from '@/api/workspace';
import { useSession } from '@/session/SessionProvider';
import { BottomSheet, Button, Field, Input, Loading, Radio, Screen, SegmentedTabs, SelectField, SubAppBar, Text, useSnackbar } from '@/ui';

const POLA_KODE = /^[A-Z][A-Z0-9]{1,9}$/;

export default function LayarWorkspaceBaru(): React.JSX.Element {
  const params = useLocalSearchParams<{ template?: string }>();
  const snackbar = useSnackbar();
  const { user } = useSession();
  const otomasi = user?.features.automation === true;

  const daftar = useResource<DaftarWorkspace>('workspace:daftar', ambilDaftarWorkspace);
  const templat = useResource<TemplatWorkspace[]>(otomasi ? 'workspace:templat' : null, ambilTemplatWorkspace);

  const [jenis, setJenis] = useState<'team' | 'project'>('team');
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [visibilitas, setVisibilitas] = useState<'private' | 'internal'>('private');
  const [timId, setTimId] = useState<string | null>(null);
  const [templatId, setTemplatId] = useState<string | null>(typeof params.template === 'string' ? params.template : null);
  const [sheet, setSheet] = useState<'tim' | 'templat' | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<Record<string, string>>({});

  const bolehTim = daftar.data?.can_create.team ?? false;
  const bolehProyek = daftar.data?.can_create.project ?? false;
  const pilihTemplat = templat.data?.find((t) => t.id === templatId) ?? null;
  const jenisEfektif = pilihTemplat ? pilihTemplat.type : jenis;
  const tim = daftar.data?.teams.find((t) => t.id === timId) ?? null;

  useEffect(() => {
    if (daftar.data && !pilihTemplat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jenis awal mengikuti hak membuat
      setJenis((j) => (j === 'team' && !bolehTim && bolehProyek ? 'project' : j));
    }
  }, [daftar.data, bolehTim, bolehProyek, pilihTemplat]);

  const kodeBersih = useMemo(() => kode.trim().toUpperCase(), [kode]);

  async function simpan(): Promise<void> {
    const baru: Record<string, string> = {};
    if (nama.trim() === '') {
      baru.name = 'Nama workspace wajib diisi.';
    }
    if (kodeBersih !== '' && !POLA_KODE.test(kodeBersih)) {
      baru.key = 'Kode 2–10 huruf kapital/angka dan diawali huruf, mis. PLQ.';
    }
    setGalat(baru);
    if (Object.keys(baru).length > 0) {
      return;
    }
    setMenyimpan(true);
    try {
      const hasil = await buatWorkspace({
        ...(pilihTemplat ? { template_id: pilihTemplat.id } : { type: jenis, ...(jenis === 'team' && timId ? { team_id: timId } : {}) }),
        name: nama.trim(),
        key: kodeBersih === '' ? undefined : kodeBersih,
        visibility: visibilitas,
      });
      hapusCache('workspace:daftar');
      snackbar.show({ message: hasil.message, variant: 'ok' });
      router.replace(`/workspace/${hasil.workspace.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const peta: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          peta[k] = v[0] ?? err.message;
        }
        setGalat(Object.keys(peta).length > 0 ? peta : { name: err.message });
      } else {
        snackbar.show({ message: err instanceof ApiError ? err.message : 'Workspace gagal dibuat.', variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
      }
    } finally {
      setMenyimpan(false);
    }
  }

  const footer = (
    <>
      <View style={{ flex: 1 }}>
        <Button title="Batal" variant="outline" onPress={() => router.back()} disabled={menyimpan} />
      </View>
      <View style={{ flex: 1.4 }}>
        <Button title="Buat workspace" icon="plus" onPress={() => void simpan()} loading={menyimpan} loadingTitle="Membuat…" disabled={!daftar.data || (!bolehTim && !bolehProyek)} />
      </View>
    </>
  );

  return (
    <Screen header={<SubAppBar title="Workspace baru" />} footer={footer}>
      {daftar.memuat && !daftar.data ? (
        <Loading rows={4} />
      ) : daftar.galat && !daftar.data ? (
        <GalatMuat galat={daftar.galat} judul="Form belum bisa dimuat" onCoba={() => void daftar.muat()} />
      ) : daftar.data && !bolehTim && !bolehProyek ? (
        <Text variant="body" tone="muted">
          Anda belum berwenang membuat workspace tim atau proyek. Hubungi Kepala Divisi atau Direksi.
        </Text>
      ) : (
        <>
          {otomasi && (templat.data?.length ?? 0) > 0 ? (
            <Field label="Template" hint={pilihTemplat ? `${pilihTemplat.type_label} · ${pilihTemplat.statuses.length} kolom` : 'Tanpa template: 5 kolom bawaan.'}>
              <SelectField value={pilihTemplat?.name ?? '5 kolom bawaan'} onPress={() => setSheet('templat')} accessibilityLabel="Template workspace" />
            </Field>
          ) : null}

          {!pilihTemplat && bolehTim && bolehProyek ? (
            <Field label="Jenis">
              <SegmentedTabs
                value={jenis}
                onChange={setJenis}
                options={[
                  { value: 'team', label: 'Tim' },
                  { value: 'project', label: 'Proyek' },
                ]}
              />
            </Field>
          ) : null}

          <Field label="Nama" required error={galat.name}>
            <Input value={nama} onChangeText={setNama} placeholder={jenisEfektif === 'project' ? 'Pindah gudang cabang' : 'Tim Konten'} maxLength={120} invalid={galat.name !== undefined} accessibilityLabel="Nama workspace" returnKeyType="next" />
          </Field>

          <Field label="Kode (prefiks tugas)" hint={kodeBersih === '' ? 'Kosongkan untuk dibuat otomatis. Contoh: PLQ.' : `Tugas bernomor ${kodeBersih}-1, ${kodeBersih}-2, …`} error={galat.key ?? undefined}>
            <Input value={kode} onChangeText={(v) => setKode(v.toUpperCase().replace(/[^A-Z0-9]/gi, '').slice(0, 10))} placeholder="PGC" autoCapitalize="characters" autoCorrect={false} maxLength={10} invalid={galat.key !== undefined} accessibilityLabel="Kode workspace" />
          </Field>

          <Field label="Visibilitas" hint={visibilitas === 'internal' ? 'Internal: semua karyawan bisa melihat, hanya anggota yang mengubah.' : 'Privat: hanya anggota yang bisa melihat.'}>
            <SegmentedTabs
              value={visibilitas}
              onChange={setVisibilitas}
              options={[
                { value: 'private', label: 'Privat' },
                { value: 'internal', label: 'Internal' },
              ]}
            />
          </Field>

          {jenisEfektif === 'team' && !pilihTemplat && (daftar.data?.teams.length ?? 0) > 0 ? (
            <Field label="Tim tertaut" hint="Anggota tim ikut menjadi anggota workspace.">
              <SelectField value={tim?.name ?? null} placeholder="Tidak ditautkan" onPress={() => setSheet('tim')} accessibilityLabel="Tim tertaut" />
            </Field>
          ) : null}

          <Text variant="meta">Anggota, kolom status, dan label diatur di Pengaturan workspace (desktop).</Text>
        </>
      )}

      <BottomSheet visible={sheet === 'tim'} onClose={() => setSheet(null)} title="Tim tertaut" scrollable>
        <Radio selected={timId === null} label="Tidak ditautkan" onSelect={() => { setTimId(null); setSheet(null); }} />
        {(daftar.data?.teams ?? []).map((t) => (
          <Radio key={t.id} selected={timId === t.id} label={t.name} onSelect={() => { setTimId(t.id); setSheet(null); }} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'templat'} onClose={() => setSheet(null)} title="Template workspace" scrollable>
        <Radio selected={templatId === null} label="5 kolom bawaan" description="Tanpa template." onSelect={() => { setTemplatId(null); setSheet(null); }} />
        {(templat.data ?? []).map((t) => (
          <Radio
            key={t.id}
            selected={templatId === t.id}
            label={t.name}
            description={`${t.type_label} · ${t.statuses.length} kolom${t.can_use ? '' : ' · tidak boleh Anda pakai'}`}
            disabled={!t.can_use}
            onSelect={() => { setTemplatId(t.id); setSheet(null); }}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
