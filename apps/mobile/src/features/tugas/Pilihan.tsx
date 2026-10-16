/**
 * Sheet pilihan bersama modul Tugas: prioritas, status, penanggung (banyak),
 * label (banyak), tenggat cepat, dan pemilih workspace (yang terkunci
 * ditandai gembok). Setiap sheet berdiri sendiri (gorhom, bisa bertumpuk).
 */
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import type { KelompokWorkspaceTugas, LabelTugas, OpsiStatus, OpsiWorkspace, Orang } from '@/api/tugas';
import { fontFamily, radius, useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, DateInput, Icon, Pressable, Text, tanggal } from '@/ui';

import { PriorityBars, StatusRing, UbinWorkspace } from './ikon';
import { LABEL_PRIORITAS, hariSingkat, tambahHari } from './util';
import { useTutupPapanKetik } from './useTutupPapanKetik';
import { warnaPalet } from '@/lib/palette';

/** Isian teks untuk dipakai DI DALAM bottom sheet (menangani papan ketik). */
export function SheetInput({ invalid, style, ...rest }: TextInputProps & { invalid?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const [fokus, setFokus] = useState(false);
  return (
    <BottomSheetTextInput
      placeholderTextColor={colors.subtle}
      {...rest}
      onFocus={(e) => {
        setFokus(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFokus(false);
        rest.onBlur?.(e);
      }}
      style={[
        {
          minHeight: 52,
          borderRadius: radius.control,
          borderWidth: 1.5,
          borderColor: invalid ? colors.danger : fokus ? colors.primary : colors.borderStrong,
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontFamily: fontFamily[400],
          fontSize: 17,
          color: colors.text,
        },
        style as object,
      ]}
    />
  );
}

function BarisPilihan({
  terpilih,
  onPress,
  leading,
  judul,
  deskripsi,
  terkunci = false,
  tone = 'default',
}: {
  terpilih?: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
  judul: string;
  deskripsi?: string;
  terkunci?: boolean;
  tone?: 'default' | 'danger';
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={terkunci ? `${judul}, terkunci${deskripsi ? `, ${deskripsi}` : ''}` : judul}
      accessibilityState={{ selected: terpilih === true }}
      style={[s.baris, terpilih ? { backgroundColor: colors.linkSoft } : null]}
    >
      {leading ? <View style={s.lead}>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="title" tone={terkunci ? 'subtle' : tone === 'danger' ? 'danger' : terpilih ? 'link' : 'text'}>
          {judul}
        </Text>
        {deskripsi ? <Text variant="meta">{deskripsi}</Text> : null}
      </View>
      {terkunci ? <Icon name="lock" size={20} color={colors.subtle} /> : terpilih ? <Icon name="check" size={22} color={colors.link} /> : null}
    </Pressable>
  );
}

export function SheetPrioritas({ visible, onClose, nilai, onPilih, subjudul }: { visible: boolean; onClose: () => void; nilai: number; onPilih: (n: number) => void; subjudul?: string }): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Prioritas" showClose>
      {subjudul ? <Text variant="meta">{subjudul}</Text> : null}
      {[1, 2, 3, 4, 0].map((n) => (
        <BarisPilihan
          key={n}
          terpilih={nilai === n}
          judul={LABEL_PRIORITAS[n] ?? ''}
          leading={n === 0 ? <Icon name="minus" size={20} /> : <PriorityBars nilai={n} size={22} />}
          onPress={() => {
            onPilih(n);
            onClose();
          }}
        />
      ))}
    </BottomSheet>
  );
}

export function SheetStatus({
  visible,
  onClose,
  statuses,
  nilai,
  onPilih,
  judul = 'Pindahkan tugas',
  subjudul,
  catatan,
}: {
  visible: boolean;
  onClose: () => void;
  statuses: Pick<OpsiStatus, 'id' | 'name' | 'category'>[];
  nilai: string | null;
  onPilih: (id: string) => void;
  judul?: string;
  subjudul?: string;
  catatan?: string;
}): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={judul} showClose scrollable>
      {subjudul ? <Text variant="meta">{subjudul}</Text> : null}
      {statuses.length === 0 ? (
        <Text variant="body" tone="muted">
          Kolom status workspace ini belum dimuat. Tutup lalu coba lagi.
        </Text>
      ) : null}
      {statuses.map((st) => (
        <BarisPilihan
          key={st.id}
          terpilih={nilai === st.id}
          judul={st.name}
          leading={<StatusRing kategori={st.category} size={26} />}
          onPress={() => {
            onPilih(st.id);
            onClose();
          }}
        />
      ))}
      {catatan ? <Text variant="meta">{catatan}</Text> : null}
    </BottomSheet>
  );
}

export function SheetOrang({
  visible,
  onClose,
  judul = 'Penanggung jawab',
  orang,
  terpilih,
  onSimpan,
  idSaya,
  memuat = false,
}: {
  visible: boolean;
  onClose: () => void;
  judul?: string;
  orang: Orang[];
  terpilih: string[];
  onSimpan: (ids: string[]) => void;
  /** Pengguna yang masuk: ditaruh paling atas dengan tanda "(Saya)" (sama dengan web). */
  idSaya?: string | null;
  /** Daftar anggota masih dimuat. */
  memuat?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [draf, setDraf] = useState<string[]>(terpilih);
  const [cari, setCari] = useState('');
  const [terakhir, setTerakhir] = useState(visible);
  if (visible !== terakhir) {
    setTerakhir(visible);
    if (visible) {
      setDraf(terpilih);
      setCari('');
    }
  }
  const urut = [...orang].sort((a, b) => (a.id === idSaya ? -1 : b.id === idSaya ? 1 : a.name.localeCompare(b.name, 'id')));
  const kata = cari.trim().toLowerCase();
  const tampil = kata === '' ? urut : urut.filter((o) => o.name.toLowerCase().includes(kata));
  const sama = draf.length === terpilih.length && draf.every((id) => terpilih.includes(id));
  // Tombol Simpan bisa di luar layar pada daftar panjang: menutup lembar (×, seret, ketuk luar,
  // tombol kembali) ikut menyimpan pilihan supaya centang tidak hilang diam-diam.
  const simpanTutup = (): void => {
    if (!sama) {
      onSimpan(draf);
    }
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={simpanTutup} title={judul} showClose scrollable>
      <Text variant="meta">{memuat ? 'Memuat anggota…' : `${orang.length} anggota · boleh lebih dari satu`}</Text>
      {orang.length > 8 ? <SheetInput value={cari} onChangeText={setCari} placeholder="Cari anggota" accessibilityLabel="Cari anggota" returnKeyType="search" /> : null}
      {!memuat && orang.length === 0 ? (
        <Text variant="body" tone="muted">
          Tidak ada anggota yang bisa dipilih.
        </Text>
      ) : null}
      {orang.length > 0 && tampil.length === 0 ? (
        <Text variant="body" tone="muted">
          Tidak ada anggota bernama “{cari.trim()}”.
        </Text>
      ) : null}
      {tampil.map((o) => {
        const dipilih = draf.includes(o.id);
        const nama = o.id === idSaya ? `${o.name} (Saya)` : o.name;
        return (
          <Pressable
            key={o.id}
            scaleTo={1}
            onPress={() => setDraf((d) => (d.includes(o.id) ? d.filter((x) => x !== o.id) : [...d, o.id]))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dipilih }}
            accessibilityLabel={nama}
            style={[s.baris, dipilih ? { backgroundColor: colors.linkSoft } : null]}
          >
            <Avatar name={o.name} size="sm" ring={o.id === idSaya} />
            <Text variant="title" tone={dipilih ? 'link' : 'text'} style={{ flex: 1 }} numberOfLines={1}>
              {nama}
            </Text>
            {dipilih ? <Icon name="check" size={22} color={colors.link} /> : null}
          </Pressable>
        );
      })}
      <View style={s.kaki}>
        <View style={{ flex: 1 }}>
          <Button title="Kosongkan" variant="outline" disabled={draf.length === 0} onPress={() => setDraf([])} />
        </View>
        <View style={{ flex: 1.4 }}>
          <Button
            title={draf.length === 0 ? 'Simpan · tanpa orang' : `Simpan · ${draf.length} orang`}
            onPress={simpanTutup}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

export function SheetLabel({
  visible,
  onClose,
  label,
  terpilih,
  onSimpan,
  memuat = false,
}: {
  visible: boolean;
  onClose: () => void;
  label: LabelTugas[];
  terpilih: string[];
  onSimpan: (ids: string[]) => void;
  /** Label workspace masih dimuat (bukan "belum punya label"). */
  memuat?: boolean;
}): React.JSX.Element {
  const { colors, dark } = useTheme();
  useTutupPapanKetik(visible);
  const [draf, setDraf] = useState<string[]>(terpilih);
  const [terakhir, setTerakhir] = useState(visible);
  if (visible !== terakhir) {
    setTerakhir(visible);
    if (visible) {
      setDraf(terpilih);
    }
  }
  // Hanya label workspace ini (pilihan dari workspace lain/terhapus dibuang saat disimpan).
  const sah = draf.filter((id) => label.some((l) => l.id === id));
  const sama = sah.length === terpilih.length && sah.every((id) => terpilih.includes(id));
  // Sama dengan pemilih penanggung jawab: menutup lembar (×, seret, ketuk luar, kembali)
  // ikut menyimpan, supaya centang label tidak hilang diam-diam.
  const simpanTutup = (): void => {
    if (!sama && label.length > 0) {
      onSimpan(sah);
    }
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={simpanTutup} title="Label" showClose scrollable>
      {label.length > 0 ? <Text variant="meta">{`${label.length} label workspace · boleh lebih dari satu`}</Text> : null}
      {label.length === 0 ? (
        <Text variant="body" tone="muted" accessibilityLiveRegion="polite">
          {memuat ? 'Memuat label workspace…' : 'Workspace ini belum punya label. Label dibuat di pengaturan workspace (desktop).'}
        </Text>
      ) : null}
      {label.map((l) => {
        const dipilih = draf.includes(l.id);
        return (
          <Pressable
            key={l.id}
            scaleTo={1}
            onPress={() => setDraf((d) => (d.includes(l.id) ? d.filter((x) => x !== l.id) : [...d, l.id]))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dipilih }}
            accessibilityLabel={`Label ${l.name}`}
            style={[s.baris, dipilih ? { backgroundColor: colors.linkSoft } : null]}
          >
            <View style={s.lead}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: warnaPalet(l.color, dark) }} />
            </View>
            <Text variant="title" tone={dipilih ? 'link' : 'text'} style={{ flex: 1 }} numberOfLines={1}>
              {l.name}
            </Text>
            {dipilih ? <Icon name="check" size={22} color={colors.link} /> : null}
          </Pressable>
        );
      })}
      {label.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Button title="Kosongkan" variant="outline" disabled={sah.length === 0} onPress={() => setDraf([])} />
          </View>
          <View style={{ flex: 1.4 }}>
            <Button
              title={sah.length === 0 ? 'Simpan · tanpa label' : `Simpan · ${sah.length} label`}
              onPress={simpanTutup}
            />
          </View>
        </View>
      ) : (
        <Button title="Tutup" variant="outline" onPress={onClose} />
      )}
    </BottomSheet>
  );
}

function batasTeks(min: string | undefined, max: string | undefined): string {
  if (min && max) {
    return `Pilih antara ${tanggal.formatHariTanggal(min)} dan ${tanggal.formatHariTanggal(max)}.`;
  }
  if (min) {
    return `Tanggal sebelum ${tanggal.formatHariTanggal(min)} tidak bisa dipilih.`;
  }
  return max ? `Tanggal setelah ${tanggal.formatHariTanggal(max)} (tenggat) tidak bisa dipilih.` : '';
}

/**
 * Tenggat cepat: Hari ini · Besok · Lusa · Pekan depan · Pilih tanggal · Hapus.
 * Tanggal di luar `min`/`max` (mis. sebelum tanggal mulai) tidak ditawarkan.
 */
export function SheetTenggat({
  visible,
  onClose,
  nilai,
  hariIni,
  onPilih,
  judul = 'Tenggat',
  subjudul,
  boleKosongkan = true,
  min,
  max,
}: {
  visible: boolean;
  onClose: () => void;
  nilai: string | null;
  hariIni: string;
  onPilih: (iso: string | null) => void;
  judul?: string;
  subjudul?: string;
  boleKosongkan?: boolean;
  min?: string;
  max?: string;
}): React.JSX.Element {
  useTutupPapanKetik(visible);
  const p = tanggal.parseIso(hariIni);
  const ke = p ? (tanggal.hariKe(p) + 6) % 7 : 0; // 0 = Senin
  const pekanDepan = tambahHari(hariIni, 7 - ke);
  const semua: { judul: string; iso: string; icon: 'sun' | 'calendar-plus' | 'calendar-arrow-down' }[] = [
    { judul: 'Hari ini', iso: hariIni, icon: 'sun' },
    { judul: 'Besok', iso: tambahHari(hariIni, 1), icon: 'calendar-plus' },
    { judul: 'Lusa', iso: tambahHari(hariIni, 2), icon: 'calendar-plus' },
    { judul: 'Pekan depan', iso: pekanDepan, icon: 'calendar-arrow-down' },
  ];
  const opsi = semua.filter((o) => (!min || o.iso >= min) && (!max || o.iso <= max));
  // Tanggal tersimpan yang bukan pilihan cepat → isian tanggal langsung terbuka.
  const lain = nilai !== null && !opsi.some((o) => o.iso === nilai);
  const [pilih, setPilih] = useState(lain);
  const [terakhir, setTerakhir] = useState(visible);
  if (visible !== terakhir) {
    setTerakhir(visible);
    if (visible) {
      setPilih(lain);
    }
  }
  const tutup = (): void => {
    setPilih(false);
    onClose();
  };
  const namaHapus = judul === 'Tenggat' ? 'Hapus tenggat' : `Hapus ${judul.toLowerCase()}`;
  return (
    <BottomSheet visible={visible} onClose={tutup} title={judul} showClose scrollable>
      {subjudul ? <Text variant="meta">{subjudul}</Text> : null}
      {opsi.map((o) => (
        <BarisPilihan
          key={o.judul}
          terpilih={nilai === o.iso}
          judul={o.judul}
          deskripsi={hariSingkat(o.iso)}
          leading={<Icon name={o.icon} size={22} />}
          onPress={() => {
            onPilih(o.iso);
            tutup();
          }}
        />
      ))}
      {opsi.length < semua.length ? <Text variant="meta">{batasTeks(min, max)}</Text> : null}
      <BarisPilihan
        judul="Pilih tanggal…"
        deskripsi={lain && nilai ? tanggal.formatHariTanggal(nilai) : 'Ketik dd/mm/yyyy atau buka kalender'}
        terpilih={lain}
        leading={<Icon name="calendar-search" size={22} />}
        onPress={() => setPilih((v) => !v)}
      />
      {pilih ? (
        <DateInput
          label={judul}
          value={nilai ?? ''}
          min={min}
          max={max}
          required={!boleKosongkan}
          onChange={(iso) => {
            if (iso) {
              onPilih(iso);
              tutup();
            } else if (boleKosongkan && nilai) {
              // "Hapus" di kalender / isian dikosongkan.
              onPilih(null);
              tutup();
            }
          }}
        />
      ) : null}
      {boleKosongkan && nilai ? (
        <BarisPilihan
          judul={namaHapus}
          tone="danger"
          leading={<Icon name="calendar-x" size={22} />}
          onPress={() => {
            onPilih(null);
            tutup();
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

/** Pemilih workspace: yang tak boleh diisi tugas terkunci (lihat saja / arsip). */
export function SheetWorkspace({
  visible,
  onClose,
  kelompok,
  memuat = false,
  nilai,
  onPilih,
  onTerkunci,
}: {
  visible: boolean;
  onClose: () => void;
  kelompok: KelompokWorkspaceTugas[];
  /** Daftar workspace masih dimuat (untuk keadaan kosong). */
  memuat?: boolean;
  nilai: string | null;
  onPilih: (w: OpsiWorkspace) => void;
  onTerkunci: (w: OpsiWorkspace, alasan: string) => void;
}): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih workspace" showClose scrollable>
      <Text variant="meta">Hanya yang boleh Anda isi tugas</Text>
      {kelompok.every((k) => k.items.length === 0) ? (
        <Text variant="body" tone="muted" style={{ paddingVertical: 16 }} accessibilityLiveRegion="polite">
          {memuat ? 'Memuat workspace…' : 'Belum ada workspace yang bisa Anda isi tugas.'}
        </Text>
      ) : null}
      {kelompok
        .filter((k) => k.items.length > 0)
        .map((k) => (
          <View key={k.jenis} style={{ gap: 2 }}>
            <Text variant="overline" tone="muted" style={{ marginTop: 8 }}>
              {k.label.toUpperCase()}
            </Text>
            {k.items.map((w) => {
              const kunci = w.arsip || w.view_only || w.my_role === 'viewer';
              const alasan = w.arsip ? 'diarsipkan' : 'lihat saja';
              return (
                <BarisPilihan
                  key={w.id}
                  terpilih={nilai === w.id}
                  terkunci={kunci}
                  judul={w.name}
                  deskripsi={kunci ? `${w.key} · ${alasan}` : w.key}
                  leading={<UbinWorkspace nama={w.name} jenis={w.type} size={40} />}
                  onPress={() => {
                    if (kunci) {
                      onTerkunci(w, w.arsip ? 'Workspace ini diarsipkan dan hanya bisa dibaca.' : 'Anda hanya bisa melihat workspace ini, tidak bisa menambah tugas.');
                      return;
                    }
                    onPilih(w);
                    onClose();
                  }}
                />
              );
            })}
          </View>
        ))}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.lg },
  lead: { width: 40, alignItems: 'center', justifyContent: 'center' },
  kaki: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
