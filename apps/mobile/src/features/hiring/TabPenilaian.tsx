/**
 * Profil kandidat · tab Wawancara (mockup 11 › 14: jawaban kandidat simpan
 * otomatis, poin 1..maks + catatan, ringkasan poin, tanpa pertanyaan,
 * offline/galat), Checklist (15: grup per pemeriksa, tambah/hapus butir,
 * spanduk), dan Keputusan (17: Setujui/Tolak, butir wajib belum dicentang,
 * dialog setujui, Diterima/Ditolak, belum di tahap keputusan, konflik 409).
 * Tidak ada skor gabungan otomatis untuk keputusan (D11).
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { hapusButir, putuskanKandidat, setelButir, tambahButir, type ButirChecklist, type NilaiKeputusan, type OrangHiring, type PertanyaanKandidat, type ProfilKandidat } from '@/api/hiring';
import { tanggalJam, tanggalPanjang, tanggalTanpaTahun } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Pressable, Radio, SegmentedTabs, Switch, Text, useDialog, useSnackbar } from '@/ui';

import { angka, angkaSatu, namaDepan, pesanGalat } from './format';
import type { Jawaban } from './useJawaban';

// ── Wawancara ────────────────────────────────────────────────────────────────

export interface DrafPoin {
  score: number | null;
  note: string;
}

function TombolPoin({ nilai, maks, aktif, onPress, nonaktif }: { nilai: number; maks: number; aktif: boolean; onPress: () => void; nonaktif: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={nonaktif}
      scaleTo={0.94}
      accessibilityRole="radio"
      accessibilityLabel={`Poin ${nilai} dari ${maks}`}
      accessibilityState={{ selected: aktif, disabled: nonaktif }}
      style={[s.poin, { backgroundColor: aktif ? colors.primary : colors.surface, borderColor: aktif ? colors.primary : colors.borderStrong, opacity: nonaktif ? 0.5 : 1 }]}
    >
      <Text variant="title" weight={700} style={{ color: aktif ? colors.primaryFg : colors.text }}>
        {String(nilai)}
      </Text>
    </Pressable>
  );
}

function StatusSimpan({ status, pesan, onCobaLagi }: { status: string | undefined; pesan?: string; onCobaLagi: () => void }): React.JSX.Element | null {
  if (status === 'menyimpan') {
    return <Text variant="meta">Menyimpan…</Text>;
  }
  if (status === 'tersimpan') {
    return (
      <Text variant="meta" tone="success">
        Tersimpan
      </Text>
    );
  }
  if (status === 'menunggu') {
    return (
      <Text variant="meta" tone="warning" accessibilityLiveRegion="polite">
        Menunggu jaringan… Jawaban dikirim otomatis saat tersambung (tidak disimpan di perangkat).
      </Text>
    );
  }
  if (status === 'gagal') {
    return (
      <View style={{ gap: 4, alignItems: 'flex-start' }}>
        <Text variant="meta" tone="danger" accessibilityRole="alert">
          {pesan ?? 'Gagal menyimpan. Coba lagi.'}
        </Text>
        <Button title="Coba simpan lagi" variant="quiet" icon="refresh-cw" onPress={onCobaLagi} />
      </View>
    );
  }
  return null;
}

function KartuPertanyaan({
  q,
  nomor,
  p,
  jawaban,
  draf,
  galatPoin,
  offline,
  onDraf,
}: {
  q: PertanyaanKandidat;
  nomor: number;
  p: ProfilKandidat;
  jawaban: Jawaban;
  draf: DrafPoin | undefined;
  galatPoin: string | undefined;
  offline: boolean;
  onDraf: (qid: string, d: DrafPoin | null) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const kj = jawaban.keadaan[q.id];
  const teksJawaban = kj ? kj.teks : (q.answer ?? '');
  const skor = draf ? draf.score : (q.my_score?.score ?? null);
  const catatan = draf ? draf.note : (q.my_score?.note ?? '');

  function pilihPoin(n: number): void {
    const baru = skor === n ? null : n;
    onDraf(q.id, { score: baru, note: baru === null ? '' : catatan });
  }

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Text variant="title" style={{ flex: 1 }}>{`${nomor}. ${q.prompt}`}</Text>
        {q.average !== null ? <Badge tone="info">{`Rata-rata ${angka(q.average)}`}</Badge> : null}
      </View>
      {q.guidance ? (
        <Text variant="meta" style={{ fontSize: 14 }}>
          {`Panduan: ${q.guidance}`}
        </Text>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text variant="label">Jawaban kandidat</Text>
        {p.can.answer ? (
          <>
            <Input
              value={teksJawaban}
              onChangeText={(t) => jawaban.ubah(q.id, t)}
              multiline
              textAlignVertical="top"
              maxLength={20_000}
              placeholder="Ketik jawaban kandidat (tersimpan otomatis)"
              style={{ minHeight: 88 }}
              accessibilityLabel={`Jawaban kandidat untuk pertanyaan ${nomor}`}
            />
            <StatusSimpan status={kj?.status} pesan={kj?.pesan} onCobaLagi={() => jawaban.cobaLagi(q.id)} />
          </>
        ) : (
          <Text variant="body" tone={q.answer ? 'text' : 'muted'} selectable>
            {q.answer ?? 'Belum ada jawaban yang dicatat HR.'}
          </Text>
        )}
      </View>

      {q.scores !== null ? (
        <View style={{ gap: 4 }}>
          <Text variant="label">Poin pewawancara</Text>
          {q.scores.length === 0 ? (
            <Text variant="body" tone="muted">
              Belum ada poin.
            </Text>
          ) : (
            q.scores.map((sk) => (
              <View key={sk.interviewer.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 }}>
                <Avatar name={sk.interviewer.name} size="sm" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{`${sk.interviewer.name}  ${sk.score}/${q.max_score}`}</Text>
                  {sk.note ? (
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      {sk.note}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {p.can.score ? (
        <View style={{ gap: 8 }}>
          <Text variant="label">Poin Anda</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={`Poin Anda untuk pertanyaan ${nomor}`}>
            {Array.from({ length: q.max_score }, (_, i) => i + 1).map((n) => (
              <TombolPoin key={n} nilai={n} maks={q.max_score} aktif={skor === n} nonaktif={offline} onPress={() => pilihPoin(n)} />
            ))}
          </View>
          {skor !== null ? (
            <Field label="Catatan" hint="Opsional · hanya Anda, HR, dan penyetuju yang melihat.">
              <Input
                value={catatan}
                onChangeText={(t) => onDraf(q.id, { score: skor, note: t })}
                multiline
                textAlignVertical="top"
                maxLength={5000}
                accessibilityLabel={`Catatan poin pertanyaan ${nomor}`}
              />
            </Field>
          ) : (
            <Text variant="meta" style={{ fontSize: 14 }}>
              Pilih poin dulu untuk menulis catatan.
            </Text>
          )}
          {draf ? (
            <Text variant="meta" tone="warning">
              Belum disimpan
            </Text>
          ) : null}
          {galatPoin ? (
            <Text variant="meta" tone="danger" accessibilityRole="alert">
              {galatPoin}
            </Text>
          ) : null}
        </View>
      ) : q.my_score ? (
        <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.surface2, gap: 2 }}>
          <Text variant="label">{`Poin Anda: ${q.my_score.score}/${q.max_score}`}</Text>
          {q.my_score.note ? <Text variant="meta">{q.my_score.note}</Text> : null}
        </View>
      ) : null}
    </Card>
  );
}

function RingkasanPoin({ p }: { p: ProfilKandidat }): React.JSX.Element {
  const sk = p.summary.score;
  const saya = p.summary.my_score;
  if (sk) {
    return (
      <View style={{ gap: 12 }}>
        <Card style={{ gap: 6 }}>
          <Text variant="label">Total poin</Text>
          <Text variant="kpi">{`${angkaSatu(sk.total)} / ${sk.max}`}</Text>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {`Jumlah rata-rata per pertanyaan ÷ poin maksimum pertanyaan yang sudah dinilai (${sk.scored_questions} dari ${sk.questions} pertanyaan).`}
          </Text>
        </Card>
        <Card style={{ gap: 6 }}>
          <Text variant="h3">Rata-rata per pertanyaan</Text>
          {p.questions.map((q, i) => (
            <View key={q.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 36 }}>
              <Text variant="label" style={{ width: 28 }}>
                {String(i + 1)}
              </Text>
              <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {q.prompt}
              </Text>
              <Text variant="label">{q.average !== null ? `${angka(q.average)}/${q.max_score}` : '—'}</Text>
            </View>
          ))}
        </Card>
        <Card style={{ gap: 6 }}>
          <Text variant="h3">Per pewawancara</Text>
          {sk.by_interviewer.map((b) => (
            <View key={b.interviewer.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 }}>
              <Avatar name={b.interviewer.name} size="sm" />
              <Text variant="label" style={{ flex: 1 }}>
                {b.interviewer.name}
              </Text>
              <Text variant="label">{b.count > 0 ? `${angka(b.total / b.count)} rata-rata/${angka(b.max / b.count)}` : '—'}</Text>
            </View>
          ))}
        </Card>
        <Text variant="meta" style={{ fontSize: 14 }}>
          Penyetuju akhir dan HR melihat semua poin; pewawancara hanya poinnya sendiri. Tidak ada skor gabungan otomatis untuk keputusan.
        </Text>
      </View>
    );
  }
  if (saya) {
    return (
      <Card style={{ gap: 6 }}>
        <Text variant="label">Total poin Anda</Text>
        <Text variant="kpi">{`${saya.total} / ${saya.max}`}</Text>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {`${saya.scored_questions} dari ${saya.questions} pertanyaan sudah Anda nilai. Hanya poin Anda sendiri yang terlihat.`}
        </Text>
      </Card>
    );
  }
  return <EmptyState icon="chart-bar" title="Belum ada poin" description="Ringkasan muncul setelah pewawancara memberi poin." variant="plain" />;
}

export function TabWawancara({
  p,
  jawaban,
  draf,
  galatPoin,
  offline,
  onDraf,
  onBukaLowongan,
}: {
  p: ProfilKandidat;
  jawaban: Jawaban;
  draf: Record<string, DrafPoin>;
  galatPoin: Record<string, string>;
  offline: boolean;
  onDraf: (qid: string, d: DrafPoin | null) => void;
  onBukaLowongan?: () => void;
}): React.JSX.Element {
  const [mode, setMode] = useState<'pertanyaan' | 'ringkasan'>('pertanyaan');
  const bisaRingkas = p.summary.score !== null || p.summary.my_score !== null || p.can.see_all_scores;

  if (p.questions.length === 0) {
    return (
      <EmptyState
        icon="clipboard-list"
        title="Belum ada pertanyaan wawancara"
        description={p.can.manage ? 'Siapkan pertanyaan di pengaturan lowongan.' : 'HR belum menyiapkan pertanyaan untuk lowongan ini.'}
        actionLabel={p.can.manage && onBukaLowongan ? 'Buka pengaturan lowongan' : undefined}
        onAction={p.can.manage ? onBukaLowongan : undefined}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {bisaRingkas ? (
        <SegmentedTabs
          value={mode}
          options={[
            { value: 'pertanyaan', label: 'Per pertanyaan' },
            { value: 'ringkasan', label: 'Ringkasan poin' },
          ]}
          onChange={setMode}
        />
      ) : null}
      {p.can.is_interviewer && !p.can.see_all_scores ? <Banner tone="info" message="Anda pewawancara: hanya poin Anda sendiri yang terlihat." /> : null}
      {offline && (p.can.score || p.can.answer) ? <Banner tone="neutral" icon="cloud-off" message="Offline. Jawaban dikirim otomatis saat tersambung; poin bisa disimpan setelah tersambung." /> : null}
      {mode === 'ringkasan' && bisaRingkas ? (
        <RingkasanPoin p={p} />
      ) : (
        p.questions.map((q, i) => <KartuPertanyaan key={q.id} q={q} nomor={i + 1} p={p} jawaban={jawaban} draf={draf[q.id]} galatPoin={galatPoin[q.id]} offline={offline} onDraf={onDraf} />)
      )}
    </View>
  );
}

// ── Checklist ────────────────────────────────────────────────────────────────

interface GrupButir {
  kunci: string;
  judul: string;
  avatar: string;
  milikSaya: boolean;
  butir: ButirChecklist[];
}

function kelompokkan(p: ProfilKandidat, saya: string | null): GrupButir[] {
  const urutanOrang = [...p.reviewers.interviewers.map((o) => `interviewer:${o.id}`), ...p.reviewers.approvers.map((o) => `approver:${o.id}`)];
  const peta = new Map<string, GrupButir>();
  for (const b of p.checklist) {
    const kunci = b.role === 'hr' ? 'hr' : `${b.role}:${b.reviewer?.id ?? ''}`;
    let g = peta.get(kunci);
    if (!g) {
      const nama = b.reviewer?.name ?? 'Pemeriksa';
      const anda = b.reviewer !== null && b.reviewer.id === saya;
      g = {
        kunci,
        judul: b.role === 'hr' ? 'HR' : `${b.role === 'interviewer' ? 'Pewawancara' : 'Penyetuju'} · ${nama}${anda ? ' (Anda)' : ''}`,
        avatar: b.role === 'hr' ? 'H R' : nama,
        milikSaya: anda,
        butir: [],
      };
      peta.set(kunci, g);
    }
    g.butir.push(b);
  }
  const urut = (g: GrupButir): number => (g.milikSaya ? -1 : g.kunci === 'hr' ? 0 : 1 + Math.max(0, urutanOrang.indexOf(g.kunci)));
  return [...peta.values()].sort((a, b) => urut(a) - urut(b));
}

export function TabChecklist({
  p,
  offline,
  onButir,
  onSegarkan,
}: {
  p: ProfilKandidat;
  offline: boolean;
  /** Ganti/hapus butir di data layar (null = dihapus). */
  onButir: (id: string, item: ButirChecklist | null) => void;
  onSegarkan: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const saya = useMemo(() => {
    const milik = p.checklist.find((b) => b.mine && b.reviewer);
    return milik?.reviewer?.id ?? null;
  }, [p.checklist]);
  const grup = useMemo(() => kelompokkan(p, saya), [p, saya]);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [catatanUntuk, setCatatanUntuk] = useState<ButirChecklist | null>(null);
  const [catatan, setCatatan] = useState('');
  const [tambah, setTambah] = useState(false);
  const [label, setLabel] = useState('');
  const [pemeriksa, setPemeriksa] = useState<string | null>(null);
  const [wajib, setWajib] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (catatanUntuk) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang saat sheet dibuka
      setCatatan(catatanUntuk.note ?? '');
    }
  }, [catatanUntuk]);

  useEffect(() => {
    if (tambah) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat sheet dibuka
      setLabel('');
      setPemeriksa(null);
      setWajib(true);
      setGalat(null);
    }
  }, [tambah]);

  async function setel(b: ButirChecklist, checked: boolean, note?: string | null): Promise<boolean> {
    setSibuk(b.id);
    onButir(b.id, { ...b, checked_at: checked ? (b.checked_at ?? new Date().toISOString()) : null, note: note === undefined ? b.note : note });
    try {
      const hasil = await setelButir(b.id, checked, note);
      onButir(b.id, hasil.item);
      onSegarkan();
      return true;
    } catch (err) {
      onButir(b.id, b);
      snackbar.show({ message: pesanGalat(err, 'Checklist gagal disimpan.'), variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad' });
      return false;
    } finally {
      setSibuk(null);
    }
  }

  async function hapus(b: ButirChecklist): Promise<void> {
    const ok = await dialog.confirm({ title: 'Hapus butir checklist?', message: `“${b.label}” dihapus dari kandidat ini.`, confirmLabel: 'Hapus', destructive: true });
    if (!ok) {
      return;
    }
    try {
      await hapusButir(b.id);
      onButir(b.id, null);
      onSegarkan();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Butir gagal dihapus.'), variant: 'bad' });
    }
  }

  async function kirimTambah(): Promise<void> {
    if (label.trim().length < 2) {
      setGalat('Tulis butir minimal 2 karakter.');
      return;
    }
    setSibuk('baru');
    try {
      const hasil = await tambahButir(p.candidate.id, { label: label.trim(), reviewer_id: pemeriksa, required: wajib });
      setTambah(false);
      snackbar.show({ message: hasil.message, variant: 'ok' });
      onSegarkan();
    } catch (err) {
      setGalat(pesanGalat(err, 'Butir gagal ditambahkan.'));
    } finally {
      setSibuk(null);
    }
  }

  const terbuka = !['final_review', 'hired', 'rejected'].includes(p.candidate.stage);
  const pemeriksaOpsi: OrangHiring[] = [...p.reviewers.interviewers, ...p.reviewers.approvers];

  return (
    <View style={{ gap: 12 }}>
      {p.can.decide && p.blockers.my_approval > 0 ? (
        <Banner tone="info" message="Giliran Anda: centang butir penyetuju sebelum menyetujui di tab Keputusan." />
      ) : terbuka && p.blockers.before_final > 0 ? (
        <Banner tone="warn" message={`Checklist wajib belum lengkap (${p.blockers.before_final} butir). Kandidat belum bisa masuk Keputusan akhir.`} />
      ) : terbuka && p.checklist.length > 0 ? (
        <Banner tone="ok" message="Checklist wajib HR & pewawancara lengkap. Kandidat siap masuk Keputusan akhir." />
      ) : null}
      {grup.length === 0 ? <EmptyState icon="list-checks" title="Belum ada butir checklist" variant="plain" /> : null}
      {grup.map((g) => (
        <Card key={g.kunci} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Avatar name={g.avatar} size="sm" />
            <Text variant="title" style={{ flex: 1 }}>
              {g.judul}
            </Text>
          </View>
          {g.butir.map((b, i) => {
            const meta = [b.required ? 'Wajib' : 'Opsional', b.checked_at ? `${b.checked_by ? namaDepan(b.checked_by.name) : 'Dicentang'}, ${tanggalTanpaTahun(b.checked_at)}` : null].filter(Boolean).join(' · ');
            return (
              <View key={b.id} style={{ borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.divider, paddingTop: i > 0 ? 4 : 0, opacity: b.can_check ? 1 : 0.75 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Checkbox
                    checked={b.checked_at !== null}
                    onChange={(v) => void setel(b, v)}
                    disabled={!b.can_check || offline || sibuk === b.id}
                    label={b.label}
                    style={{ flex: 1 }}
                  />
                  {b.can_delete ? <IconButton icon="trash-2" label={`Hapus butir ${b.label}`} variant="ghost" onPress={() => void hapus(b)} disabled={offline} /> : null}
                </View>
                <View style={{ paddingLeft: 36, gap: 2, paddingBottom: 6 }}>
                  <Text variant="meta">{meta}</Text>
                  {b.note ? (
                    <Text variant="meta" tone="text" style={{ fontSize: 14 }}>
                      {`“${b.note}”`}
                    </Text>
                  ) : null}
                  {b.can_check ? (
                    <Pressable onPress={() => setCatatanUntuk(b)} disabled={offline} scaleTo={1} accessibilityRole="button" accessibilityLabel={`Catatan untuk ${b.label}`} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                      <Text variant="meta" tone="link" weight={700} style={{ fontSize: 14 }}>
                        {b.note ? 'Ubah catatan' : 'Catatan (opsional)'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>
      ))}
      {p.can.add_checklist ? <Button title="Tambah butir checklist" variant="outline" icon="plus" onPress={() => setTambah(true)} disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} /> : null}
      <Text variant="meta" style={{ fontSize: 14 }}>
        HR mencentang butir HR; pemeriksa lain hanya butirnya sendiri.
      </Text>

      <BottomSheet visible={catatanUntuk !== null} onClose={() => setCatatanUntuk(null)} title="Catatan butir" scrollable>
        <View style={{ gap: 14 }}>
          <Text variant="body" tone="muted" style={{ marginTop: -6 }}>
            {catatanUntuk?.label ?? ''}
          </Text>
          <Field label="Catatan" hint="Opsional, maks. 2.000 karakter.">
            <Input value={catatan} onChangeText={setCatatan} multiline textAlignVertical="top" maxLength={2000} autoFocus accessibilityLabel="Catatan butir checklist" />
          </Field>
          <Button
            title="Simpan catatan"
            loading={sibuk !== null && sibuk === catatanUntuk?.id}
            loadingTitle="Menyimpan…"
            onPress={() => {
              const b = catatanUntuk;
              if (!b) {
                return;
              }
              void setel(b, b.checked_at !== null, catatan.trim() === '' ? null : catatan.trim()).then((ok) => {
                if (ok) {
                  setCatatanUntuk(null);
                }
              });
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={tambah} onClose={() => setTambah(false)} title="Butir checklist" scrollable>
        <View style={{ gap: 14 }}>
          <Field label="Butir" required error={galat}>
            <Input
              value={label}
              onChangeText={(t) => {
                setLabel(t);
                setGalat(null);
              }}
              maxLength={200}
              placeholder="mis. Cek referensi kerja"
              invalid={galat !== null}
              accessibilityLabel="Butir checklist"
            />
          </Field>
          <Field label="Pemeriksa" hint="HR, pewawancara, atau penyetuju lowongan ini.">
            <View>
              <Radio selected={pemeriksa === null} onSelect={() => setPemeriksa(null)} label="HR (siapa saja)" />
              {pemeriksaOpsi.map((o) => (
                <Radio
                  key={o.id}
                  selected={pemeriksa === o.id}
                  onSelect={() => setPemeriksa(o.id)}
                  label={o.name}
                  description={p.reviewers.approvers.some((a) => a.id === o.id) ? 'Penyetuju akhir' : 'Pewawancara'}
                />
              ))}
            </View>
          </Field>
          <Switch value={wajib} onValueChange={setWajib} label="Wajib sebelum Keputusan akhir" />
          <Button title="Tambah butir" onPress={() => void kirimTambah()} loading={sibuk === 'baru'} loadingTitle="Menambah…" />
        </View>
      </BottomSheet>
    </View>
  );
}

// ── Keputusan ────────────────────────────────────────────────────────────────

export function TabKeputusan({
  p,
  saya,
  offline,
  konflik,
  onMuatUlang,
  onKonflik,
  onHasil,
  onBukaChecklist,
  onBukaKembali,
}: {
  p: ProfilKandidat;
  saya: string | null;
  offline: boolean;
  konflik: boolean;
  onMuatUlang: () => void;
  onKonflik: () => void;
  onHasil: (pesan: string, profil: ProfilKandidat) => void;
  onBukaChecklist: () => void;
  onBukaKembali?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const [catatan, setCatatan] = useState(p.my_decision?.note ?? '');
  const [galat, setGalat] = useState<string | null>(null);
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<NilaiKeputusan | null>(null);
  const k = p.candidate;
  const kep = p.summary.decisions;

  async function putuskan(nilai: NilaiKeputusan): Promise<void> {
    if (sibuk) {
      return;
    }
    const teks = catatan.trim();
    if (nilai === 'reject' && teks === '') {
      setGalat('Tulis alasan penolakan.');
      return;
    }
    if (nilai === 'approve' && kep.pending === 1 && p.my_decision === null && kep.rejected === 0) {
      const lain = p.decisions.filter((d) => d.decision === 'approve').map((d) => d.approver.name);
      const ok = await dialog.confirm({
        title: `Setujui ${k.full_name}?`,
        message: `${lain.length > 0 ? `${lain.join(', ')} sudah menyetujui. ` : ''}Setelah Anda setuju, ${namaDepan(k.full_name)} langsung Diterima dan HR mendapat pemberitahuan. Selama masih di Keputusan akhir keputusan Anda bisa diubah.`,
        confirmLabel: 'Ya, setujui',
      });
      if (!ok) {
        return;
      }
    }
    if (nilai === 'reject') {
      const ok = await dialog.confirm({
        title: `Tolak ${k.full_name}?`,
        message: 'Satu penolakan langsung menolak kandidat. Alasan Anda terlihat HR dan penyetuju lain di aplikasi.',
        confirmLabel: 'Tolak kandidat',
        destructive: true,
      });
      if (!ok) {
        return;
      }
    }
    setSibuk(nilai);
    setGalatUmum(null);
    try {
      const hasil = await putuskanKandidat(k.id, nilai, teks === '' ? null : teks);
      onHasil(hasil.message, hasil.candidate);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onKonflik();
      } else if (err instanceof ApiError && err.status === 422) {
        setGalat(err.errors.note?.[0] ?? null);
        setGalatUmum(err.errors.decision?.[0] ?? (err.errors.note ? null : err.message));
      } else {
        setGalatUmum(pesanGalat(err, 'Keputusan gagal dikirim.'));
      }
    } finally {
      setSibuk(null);
    }
  }

  let spanduk: React.ReactNode;
  if (k.stage === 'hired') {
    spanduk = <Banner tone="ok" message={`Diterima · semua penyetuju menyetujui${k.decided_at ? ` (${tanggalPanjang(k.decided_at)})` : ''}.`} />;
  } else if (k.stage === 'rejected') {
    const penolak = p.decisions.find((d) => d.decision === 'reject');
    spanduk = (
      <Banner
        tone="bad"
        message={`Ditolak${penolak ? ` oleh ${penolak.approver.name}` : ''}${k.rejected_reason ? `: “${k.rejected_reason}”` : ''}. Alasan hanya terlihat di aplikasi.`}
      />
    );
  } else if (k.stage === 'final_review') {
    spanduk = <Banner tone="info" message="Kandidat menunggu keputusan akhir. Diterima bila semua penyetuju menyetujui; ditolak bila salah satu menolak." />;
  } else {
    spanduk = (
      <Banner
        tone="neutral"
        title="Belum di tahap keputusan"
        message="Penyetuju akhir memutus setelah HR memindahkan kandidat ke tahap Keputusan akhir. Syarat: semua butir wajib HR dan pewawancara dicentang."
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {konflik ? <Banner tone="bad" title="Keputusan Anda tidak disimpan" message="Kandidat ini sudah diputus atau tidak lagi di tahap Keputusan akhir." actionLabel="Muat ulang" onAction={onMuatUlang} /> : null}
      {spanduk}
      <Card style={{ gap: 4 }}>
        <Text variant="h3">Penyetuju akhir</Text>
        {p.decisions.length === 0 ? (
          <Text variant="body" tone="muted">
            Lowongan ini belum punya penyetuju akhir.
          </Text>
        ) : (
          p.decisions.map((d, i) => (
            <View key={d.approver.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.divider }}>
              <Avatar name={d.approver.name} size="sm" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{`${d.approver.name}${d.approver.id === saya ? ' (Anda)' : ''}`}</Text>
                {d.note ? (
                  <Text variant="meta" tone="text" style={{ fontSize: 14 }}>
                    {`“${d.note}”`}
                  </Text>
                ) : null}
                {d.decided_at ? <Text variant="meta">{tanggalJam(d.decided_at)}</Text> : null}
              </View>
              <Badge tone={d.decision === 'approve' ? 'success' : d.decision === 'reject' ? 'danger' : 'neutral'} dot>
                {d.decision_label}
              </Badge>
            </View>
          ))
        )}
      </Card>
      {k.stage === 'rejected' && onBukaKembali ? <Button title="Buka kembali kandidat" variant="outline" icon="rotate-ccw" onPress={onBukaKembali} disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} /> : null}
      {p.can.decide && k.stage === 'final_review' ? (
        <Card style={{ gap: 12 }}>
          <Text variant="h3">Keputusan Anda</Text>
          {p.my_decision ? (
            <Text variant="body" tone="muted">
              {`Anda sudah memilih “${p.my_decision.decision === 'approve' ? 'Setujui' : 'Tolak'}”. Selama masih di Keputusan akhir, keputusan bisa diubah.`}
            </Text>
          ) : null}
          {p.blockers.my_approval > 0 ? (
            <Banner tone="warn" message={`Centang dulu ${p.blockers.my_approval} butir checklist penyetuju milik Anda sebelum menyetujui.`} actionLabel="Buka checklist" onAction={onBukaChecklist} />
          ) : null}
          <Field label="Catatan (wajib bila menolak)" error={galat}>
            <Input
              value={catatan}
              onChangeText={(t) => {
                setCatatan(t);
                setGalat(null);
              }}
              multiline
              textAlignVertical="top"
              maxLength={2000}
              placeholder="Alasan atau pertimbangan Anda"
              invalid={galat !== null}
              accessibilityLabel="Catatan keputusan"
            />
          </Field>
          {galatUmum ? (
            <Text variant="meta" tone="danger" accessibilityRole="alert" style={{ fontSize: 14 }}>
              {galatUmum}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Tolak" variant="outline" icon="circle-x" onPress={() => void putuskan('reject')} loading={sibuk === 'reject'} loadingTitle="Mengirim…" disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} style={{ flex: 1 }} />
            <Button
              title="Setujui"
              icon="circle-check"
              onPress={() => void putuskan('approve')}
              loading={sibuk === 'approve'}
              loadingTitle="Mengirim…"
              disabled={offline || p.blockers.my_approval > 0}
              disabledReason={offline ? 'Butuh koneksi' : p.blockers.my_approval > 0 ? 'Centang butir checklist Anda dulu' : undefined}
              style={{ flex: 1.4 }}
            />
          </View>
        </Card>
      ) : !p.can.decide && k.stage === 'final_review' ? (
        <Text variant="meta" style={{ fontSize: 14 }}>
          {p.can.manage ? 'HR/Direksi lain yang bukan penyetuju melihat daftar ini baca saja.' : 'Hanya penyetuju akhir lowongan ini yang memutus.'}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  poin: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
