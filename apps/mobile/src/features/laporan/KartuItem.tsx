/**
 * Satu pekerjaan di formulir laporan (mockup 28/29): terbuka = catatan progres
 * (wajib), persen (chip 0–100 + ketik), jam (stepper ±0,5 + ketik), "Pindahkan
 * ke" (sheet kolom workspace; dikunci saat mode lihat saja); diringkas =
 * catatan + chip persen/jam/tujuan + "Ubah".
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { OpsiTugas } from '@/api/laporan';
import { UbinWorkspace } from '@/features/workspace/bagian';
import { fontFamily, radius, useTheme } from '@/theme';
import { Card, Field, Gradient, Icon, IconButton, Input, Pressable, SelectField, Text } from '@/ui';

import { angkaJam, parseAngka } from './format';
import type { GalatForm, ItemForm } from './useFormLaporan';

const PERSEN = [0, 25, 50, 75, 100] as const;

export function judulItem(item: ItemForm, opsi: OpsiTugas | undefined): string {
  if (!item.taskId) return 'Pekerjaan lain (di luar tugas)';
  return opsi?.title ?? item.taskTitle ?? 'Judul tidak ditampilkan';
}

export function metaItem(item: ItemForm, opsi: OpsiTugas | undefined): string {
  if (!item.taskId) return 'Tanpa tugas di workspace';
  if (!opsi) return [item.taskKey, 'tugas tidak lagi terlihat'].filter(Boolean).join(' · ');
  return [opsi.key, opsi.workspace.name, opsi.status.name].join(' · ');
}

/** Nama kolom tujuan "Pindahkan ke" (null = tidak dipindah). */
export function namaTujuan(item: ItemForm, opsi: OpsiTugas | undefined): string | null {
  if (!item.pindahKe || !opsi) return null;
  return opsi.statuses.find((s) => s.id === item.pindahKe)?.name ?? null;
}

function UbinItem({ item, opsi }: { item: ItemForm; opsi: OpsiTugas | undefined }): React.JSX.Element {
  if (item.taskId) {
    return <UbinWorkspace nama={opsi?.workspace.key ?? item.taskKey ?? '?'} tipe={opsi?.workspace.type} ukuran={44} />;
  }
  return (
    <Gradient name="slate" style={{ width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="ellipsis" size={20} color="#FFFFFF" />
    </Gradient>
  );
}

function Pil({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'link'; icon?: 'arrow-right' }): React.JSX.Element {
  const { colors } = useTheme();
  const fg = tone === 'link' ? colors.link : colors.muted;
  return (
    <View style={[s.pil, { backgroundColor: tone === 'link' ? colors.linkSoft : colors.surface2 }]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text variant="label" style={{ color: fg, fontSize: 14 }} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

function InputJam({ nilai, onUbah, disabled, galat }: { nilai: number | null; onUbah: (n: number | null) => void; disabled: boolean; galat?: string }): React.JSX.Element {
  const [teks, setTeks] = useState(nilai === null ? '' : angkaJam(nilai));
  const [salah, setSalah] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron teks saat nilai berubah dari tombol ±
    setTeks(nilai === null ? '' : angkaJam(nilai));
  }, [nilai]);
  const terapkan = (): void => {
    const n = parseAngka(teks);
    if (teks.trim() === '') {
      setSalah(null);
      onUbah(null);
      return;
    }
    if (n === null || n < 0.25 || n > 24) {
      setSalah('Isi jam antara 0,25 dan 24.');
      return;
    }
    setSalah(null);
    onUbah(Math.round(n * 4) / 4);
  };
  const langkah = (d: number): void => {
    const dasar = nilai ?? 0;
    const baru = Math.round((dasar + d) * 2) / 2;
    setSalah(null);
    onUbah(baru <= 0 ? null : Math.min(24, baru));
  };
  return (
    <Field label="Jam (opsional)" error={salah ?? galat ?? null}>
      <View style={s.baris}>
        <IconButton icon="minus" label="Kurangi setengah jam" onPress={() => langkah(-0.5)} disabled={disabled || nilai === null} size={52} />
        <View style={{ flex: 1 }}>
          <Input
            value={teks}
            onChangeText={setTeks}
            onEndEditing={terapkan}
            onSubmitEditing={terapkan}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0 jam"
            suffix={teks.trim() === '' ? undefined : 'jam'}
            textAlign="center"
            editable={!disabled}
            disabled={disabled}
            invalid={salah !== null}
            accessibilityLabel="Jam kerja untuk pekerjaan ini"
            style={{ fontFamily: fontFamily[700] }}
          />
        </View>
        <IconButton icon="plus" label="Tambah setengah jam" onPress={() => langkah(0.5)} disabled={disabled || (nilai ?? 0) >= 24} size={52} />
      </View>
    </Field>
  );
}

function InputPersen({ nilai, onUbah, disabled, galat }: { nilai: number | null; onUbah: (n: number | null) => void; disabled: boolean; galat?: string }): React.JSX.Element {
  const { colors } = useTheme();
  const bukanPreset = nilai !== null && !(PERSEN as readonly number[]).includes(nilai);
  const [teks, setTeks] = useState(bukanPreset ? String(nilai) : '');
  const [salah, setSalah] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kosongkan ketikan saat chip dipilih
    setTeks(nilai !== null && !(PERSEN as readonly number[]).includes(nilai) ? String(nilai) : '');
  }, [nilai]);
  const terapkan = (): void => {
    if (teks.trim() === '') {
      setSalah(null);
      return;
    }
    const n = parseAngka(teks);
    if (n === null || n < 0 || n > 100 || !Number.isInteger(n)) {
      setSalah('Isi bilangan bulat 0–100.');
      return;
    }
    setSalah(null);
    onUbah(n);
  };
  return (
    <Field label="Persen selesai (opsional)" error={salah ?? galat ?? null}>
      <View style={s.persen} accessibilityRole="radiogroup">
        {PERSEN.map((p) => {
          const aktif = nilai === p;
          return (
            <Pressable
              key={p}
              onPress={() => onUbah(aktif ? null : p)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: aktif, disabled }}
              accessibilityLabel={`${p} persen`}
              accessibilityHint={aktif ? 'Ketuk lagi untuk mengosongkan' : undefined}
              style={[s.chipPersen, { borderColor: aktif ? 'transparent' : colors.border, backgroundColor: aktif ? 'transparent' : colors.surface }]}
            >
              {aktif ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} /> : null}
              <Text variant="label" style={{ color: aktif ? '#FFFFFF' : colors.muted }} maxFontSizeMultiplier={1.3}>
                {`${p}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.baris, { gap: 10 }]}>
        <Text variant="meta" style={{ fontSize: 14 }}>
          atau ketik
        </Text>
        <View style={{ width: 110 }}>
          <Input
            value={teks}
            onChangeText={setTeks}
            onEndEditing={terapkan}
            onSubmitEditing={terapkan}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="mis. 60"
            suffix="%"
            maxLength={3}
            editable={!disabled}
            disabled={disabled}
            invalid={salah !== null}
            accessibilityLabel="Persen selesai, ketik 0 sampai 100"
          />
        </View>
      </View>
    </Field>
  );
}

export interface KartuItemProps {
  item: ItemForm;
  opsi: OpsiTugas | undefined;
  terbuka: boolean;
  galat: GalatForm;
  batasCatatan: number;
  bacaSaja: boolean;
  onBuka: () => void;
  onUbah: (patch: Partial<Omit<ItemForm, 'kunci'>>) => void;
  onHapus: () => void;
  onPilihKolom: () => void;
}

export function KartuItem({ item, opsi, terbuka, galat, batasCatatan, bacaSaja, onBuka, onUbah, onHapus, onPilihKolom }: KartuItemProps): React.JSX.Element {
  const { colors } = useTheme();
  const g = (field: string): string | undefined => galat[`item:${item.kunci}:${field}`];
  const galatCatatan = g('progress_note');
  const galatTugas = g('task_id');
  const galatPindah = g('move_status_id');
  const judul = judulItem(item, opsi);
  const tujuan = namaTujuan(item, opsi);
  const kolomTersedia = item.taskId !== null && opsi !== undefined && (opsi.statuses.length > 0 || !opsi.can_move);
  const bukaPaksa = terbuka || galatCatatan !== undefined || galatPindah !== undefined || galatTugas !== undefined || g('percent') !== undefined || g('hours') !== undefined;

  const kepala = (
    <View style={s.kepala}>
      <UbinItem item={item} opsi={opsi} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={2}>
          {judul}
        </Text>
        <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
          {metaItem(item, opsi)}
        </Text>
      </View>
      {bacaSaja ? null : <IconButton icon="trash-2" label={`Hapus ${item.taskKey ?? 'pekerjaan ini'} dari laporan`} variant="ghost" onPress={onHapus} size={44} />}
    </View>
  );

  if (!bukaPaksa) {
    const ringkas: React.ReactNode[] = [];
    if (item.persen !== null) ringkas.push(<Pil key="p" label={`${item.persen}%`} />);
    if (item.jam !== null) ringkas.push(<Pil key="j" label={`${angkaJam(item.jam)} jam`} />);
    if (tujuan) ringkas.push(<Pil key="t" label={tujuan} tone="link" icon="arrow-right" />);
    return (
      <Card style={{ gap: 10 }} variant="tight">
        {kepala}
        <Text variant="body" style={{ fontSize: 16, lineHeight: 24, color: item.catatan.trim() === '' ? colors.subtle : colors.text }} numberOfLines={3}>
          {item.catatan.trim() === '' ? 'Belum ada catatan progres' : item.catatan}
        </Text>
        <View style={[s.baris, { flexWrap: 'wrap', gap: 8 }]}>
          {ringkas}
          <View style={{ flex: 1 }} />
          {bacaSaja ? null : (
            <Pressable onPress={onBuka} accessibilityRole="button" accessibilityLabel={`Ubah ${item.taskKey ?? 'pekerjaan lain'}`} style={[s.pil, { backgroundColor: colors.linkSoft, minHeight: 36 }]}>
              <Icon name="pencil" size={14} color={colors.link} />
              <Text variant="label" style={{ color: colors.link, fontSize: 14 }}>
                Ubah
              </Text>
            </Pressable>
          )}
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 16 }} variant="tight">
      {kepala}
      {galatTugas ? (
        <Text variant="meta" tone="danger">
          {galatTugas}
        </Text>
      ) : null}
      <Field label="Catatan progres" required error={galatCatatan ?? null} counter={item.catatan.length > batasCatatan * 0.8 ? `${item.catatan.length} / ${batasCatatan}` : undefined}>
        <Input
          value={item.catatan}
          onChangeText={(t) => onUbah({ catatan: t })}
          placeholder="Apa yang dikerjakan dan hasilnya"
          multiline
          maxLength={batasCatatan}
          editable={!bacaSaja}
          disabled={bacaSaja}
          invalid={galatCatatan !== undefined}
          accessibilityLabel={`Catatan progres ${item.taskKey ?? 'pekerjaan lain'}`}
          style={{ minHeight: 104, textAlignVertical: 'top', paddingTop: 14 }}
        />
      </Field>
      <InputPersen nilai={item.persen} onUbah={(n) => onUbah({ persen: n })} disabled={bacaSaja} galat={g('percent')} />
      <InputJam nilai={item.jam} onUbah={(n) => onUbah({ jam: n })} disabled={bacaSaja} galat={g('hours')} />
      {kolomTersedia && opsi ? (
        opsi.can_move ? (
          <Field label="Pindahkan ke" error={galatPindah ?? null}>
            <SelectField value={tujuan} placeholder="Tidak dipindahkan" onPress={onPilihKolom} disabled={bacaSaja} invalid={galatPindah !== undefined} accessibilityLabel={`Pindahkan ${opsi.key} ke kolom`} />
          </Field>
        ) : (
          <Field label="Pindahkan ke" hint="Mode lihat saja: tugas ini tidak bisa dipindahkan dari laporan.">
            <View style={[s.terkunci, { backgroundColor: colors.surface2, borderColor: colors.border }]} accessible accessibilityLabel="Pindahkan ke tidak tersedia, mode lihat saja">
              <Text variant="body" style={{ flex: 1, color: colors.subtle }}>
                Tidak tersedia
              </Text>
              <Icon name="lock" size={20} color={colors.muted} />
            </View>
          </Field>
        )
      ) : null}
      {galatPindah && !kolomTersedia ? (
        <Text variant="meta" tone="danger">
          {galatPindah}
        </Text>
      ) : null}
      {bacaSaja ? null : (
        <Pressable onPress={onBuka} accessibilityRole="button" accessibilityLabel="Ringkas pekerjaan ini" style={s.ringkas} scaleTo={1}>
          <Icon name="chevron-up" size={18} color={colors.link} />
          <Text variant="label" tone="link" style={{ fontSize: 14 }}>
            Ringkas
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: 999 },
  persen: { flexDirection: 'row', gap: 8 },
  chipPersen: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  terkunci: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  ringkas: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 8 },
});
