/**
 * Hiring › Pengaturan (mockup 11 › 12, HR/SA): penyetuju akhir bawaan dan
 * templat checklist per peran (HR · Pewawancara · Penyetuju). Berlaku untuk
 * lowongan/kandidat baru. `GET/PUT /hiring/pengaturan`.
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { pengaturanHiring, simpanPengaturanHiring, type OrangHiring, type PengaturanHiring, type PeranPemeriksa, type TemplatChecklist } from '@/api/hiring';
import { useTheme } from '@/theme';
import { Banner, Button, Card, ErrorState, Field, IconButton, Input, Loading, LockedState, Screen, SegmentedTabs, Switch, Text, errorKindFromStatus, useSnackbar } from '@/ui';

import { galatAwalan, galatField, pesanGalat } from './format';
import { BannerOffline, BarisOrang, HalamanTidakDitemukan, TombolLepas } from './parts';
import { PemilihOrang } from './sheets';
import { useHiringData } from './useHiringData';

const PERAN: { value: PeranPemeriksa; label: string }[] = [
  { value: 'hr', label: 'HR' },
  { value: 'interviewer', label: 'Pewawancara' },
  { value: 'approver', label: 'Penyetuju' },
];

function salinTemplat(t: TemplatChecklist): TemplatChecklist {
  return { hr: t.hr.map((b) => ({ ...b })), interviewer: t.interviewer.map((b) => ({ ...b })), approver: t.approver.map((b) => ({ ...b })) };
}

export function TabPengaturan({ header }: { header: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const m = useHiringData<PengaturanHiring>('pengaturan', pengaturanHiring);
  const d = m.data;
  const [penyetuju, setPenyetuju] = useState<string[]>([]);
  const [templat, setTemplat] = useState<TemplatChecklist>({ hr: [], interviewer: [], approver: [] });
  const [peran, setPeran] = useState<PeranPemeriksa>('hr');
  const [butirBaru, setButirBaru] = useState('');
  const [pemilih, setPemilih] = useState(false);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [dibuang, setDibuang] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [kotor, setKotor] = useState(false);

  useEffect(() => {
    if (d && !kotor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- formulir mengikuti data server selama belum diubah
      setPenyetuju(d.settings.default_final_approver_ids);
      setTemplat(salinTemplat(d.settings.checklist_template));
    }
  }, [d, kotor]);

  const orang = useMemo(() => {
    const peta = new Map<string, OrangHiring>();
    for (const o of d?.employees ?? []) {
      peta.set(o.id, o);
    }
    for (const o of d?.settings.default_final_approvers ?? []) {
      peta.set(o.id, { ...peta.get(o.id), ...o });
    }
    return peta;
  }, [d]);

  if (m.galat && m.galat.status === 404) {
    return <HalamanTidakDitemukan />;
  }
  if (m.galat && m.galat.status === 403) {
    return (
      <Screen header={header} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Hanya untuk HR" reason="Pengaturan hiring hanya bisa diubah HR dan Super Admin." />
      </Screen>
    );
  }

  const offline = m.offlineSejak !== null;
  const batas = d?.limits ?? { approvers: 10, items_per_role: 12, label: 200 };
  const daftarButir = templat[peran];

  function ubahTemplat(ubah: (t: TemplatChecklist) => void): void {
    setTemplat((lama) => {
      const baru = salinTemplat(lama);
      ubah(baru);
      return baru;
    });
    setKotor(true);
  }

  function tambahButir(): void {
    const label = butirBaru.trim();
    if (label.length < 2 || daftarButir.length >= batas.items_per_role) {
      return;
    }
    ubahTemplat((t) => {
      t[peran].push({ label: label.slice(0, batas.label), required: true });
    });
    setButirBaru('');
  }

  async function simpan(): Promise<void> {
    if (sibuk) {
      return;
    }
    setSibuk(true);
    setGalat({});
    setDibuang([]);
    const dikirim = penyetuju;
    try {
      const hasil = await simpanPengaturanHiring({ default_final_approver_ids: dikirim, checklist_template: templat });
      const tersimpan = hasil.settings.default_final_approver_ids;
      const hilang = dikirim.filter((id) => !tersimpan.includes(id)).map((id) => orang.get(id)?.name ?? 'Seorang karyawan');
      setDibuang(hilang);
      m.setData(() => ({ settings: hasil.settings, roles: hasil.roles, limits: hasil.limits, employees: hasil.employees }));
      setKotor(false);
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      const g = galatField(err);
      if (Object.keys(g).length > 0) {
        setGalat(g);
      } else {
        snackbar.show({ message: pesanGalat(err, 'Pengaturan gagal disimpan.'), variant: 'bad' });
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Screen
      header={header}
      refreshing={m.menyegarkan}
      onRefresh={() => {
        setKotor(false);
        void m.muat('tarik');
      }}
      contentStyle={{ paddingTop: 12 }}
      footer={
        d ? (
          <Button
            title="Simpan pengaturan"
            onPress={() => void simpan()}
            loading={sibuk}
            loadingTitle="Menyimpan…"
            disabled={!kotor || offline}
            disabledReason={offline ? 'Butuh koneksi' : !kotor ? 'Belum ada perubahan' : undefined}
            style={{ flex: 1 }}
          />
        ) : undefined
      }
    >
      {m.offlineSejak !== null ? <BannerOffline sejak={m.offlineSejak} /> : null}
      {m.memuat && !d ? (
        <Loading rows={5} label="Memuat pengaturan…" />
      ) : m.galat && !d ? (
        <ErrorState title="Pengaturan gagal dimuat" message={m.galat.status === 0 ? 'Periksa koneksi, lalu coba lagi.' : m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muat()} />
      ) : d ? (
        <>
          {dibuang.length > 0 ? <Banner tone="bad" message={`Penyetuju harus karyawan aktif. ${dibuang.join(', ')} tidak disimpan.`} /> : null}
          <Card style={{ gap: 4 }}>
            <Text variant="h3">Penyetuju akhir bawaan</Text>
            <Text variant="body" tone="muted">
              Dipakai untuk lowongan baru; bisa diubah per lowongan.
            </Text>
            {galatAwalan(galat, 'default_final_approver_ids') ? (
              <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
                {galatAwalan(galat, 'default_final_approver_ids')}
              </Text>
            ) : null}
            {penyetuju.length === 0 ? (
              <Text variant="body" tone="muted" style={{ paddingVertical: 8 }}>
                Belum ada penyetuju bawaan.
              </Text>
            ) : (
              penyetuju.map((id, i) => {
                const o = orang.get(id) ?? { id, name: 'Karyawan', avatar: null, position: null };
                return (
                  <BarisOrang
                    key={id}
                    orang={o}
                    divider={i > 0}
                    kanan={
                      <TombolLepas
                        nama={o.name}
                        onPress={() => {
                          setPenyetuju((lama) => lama.filter((x) => x !== id));
                          setKotor(true);
                        }}
                      />
                    }
                  />
                );
              })
            )}
            <Button title="Tambah penyetuju" variant="tonal" icon="user-plus" onPress={() => setPemilih(true)} disabled={penyetuju.length >= batas.approvers} disabledReason={`Maks. ${batas.approvers} penyetuju`} />
          </Card>

          <Card style={{ gap: 12 }}>
            <Text variant="h3">Templat checklist</Text>
            <SegmentedTabs value={peran} options={PERAN} onChange={setPeran} />
            {galatAwalan(galat, `checklist_template.${peran}`) ? (
              <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
                {galatAwalan(galat, `checklist_template.${peran}`)}
              </Text>
            ) : null}
            {daftarButir.length === 0 ? (
              <Text variant="body" tone="muted">
                Peran ini tanpa butir checklist.
              </Text>
            ) : (
              daftarButir.map((b, i) => (
                <View key={`${peran}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.divider, paddingTop: i > 0 ? 8 : 0 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="label">{b.label}</Text>
                    <Switch
                      value={b.required}
                      onValueChange={(v) =>
                        ubahTemplat((t) => {
                          const item = t[peran][i];
                          if (item) {
                            item.required = v;
                          }
                        })
                      }
                      label={b.required ? 'Wajib' : 'Opsional'}
                    />
                  </View>
                  <IconButton
                    icon="trash-2"
                    label={`Hapus butir ${b.label}`}
                    variant="ghost"
                    onPress={() =>
                      ubahTemplat((t) => {
                        t[peran].splice(i, 1);
                      })
                    }
                  />
                </View>
              ))
            )}
            <Field label="Butir baru" hint={`Maks. ${batas.items_per_role} butir per peran. Perubahan berlaku untuk kandidat baru.`}>
              <Input value={butirBaru} onChangeText={setButirBaru} maxLength={batas.label} placeholder="mis. Cek referensi kerja" onSubmitEditing={tambahButir} returnKeyType="done" accessibilityLabel="Butir checklist baru" />
            </Field>
            <Button title="Tambah butir" variant="outline" icon="plus" onPress={tambahButir} disabled={butirBaru.trim().length < 2 || daftarButir.length >= batas.items_per_role} disabledReason={daftarButir.length >= batas.items_per_role ? 'Sudah 12 butir' : 'Tulis butir dulu'} />
          </Card>
          <PemilihOrang
            visible={pemilih}
            judul="Penyetuju akhir bawaan"
            karyawan={d.employees}
            terpilih={penyetuju}
            maks={batas.approvers}
            onClose={() => setPemilih(false)}
            onSimpan={(ids) => {
              setPenyetuju(ids);
              setKotor(true);
              setPemilih(false);
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
