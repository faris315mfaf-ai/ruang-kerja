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
import { BottomSheet, Button, Checkbox, DateInput, Icon, Pressable, Text, tanggal } from '@/ui';

import { PriorityBars, StatusRing, UbinWorkspace } from './ikon';
import { LABEL_PRIORITAS, hariSingkat, tambahHari } from './util';
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
}: {
  visible: boolean;
  onClose: () => void;
  judul?: string;
  orang: Orang[];
  terpilih: string[];
  onSimpan: (ids: string[]) => void;
}): React.JSX.Element {
  const [draf, setDraf] = useState<string[]>(terpilih);
  const [terakhir, setTerakhir] = useState(visible);
  if (visible !== terakhir) {
    setTerakhir(visible);
    if (visible) {
      setDraf(terpilih);
    }
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} title={judul} showClose scrollable>
      {orang.length === 0 ? <Text variant="body" tone="muted">Tidak ada anggota yang bisa dipilih.</Text> : null}
      {orang.map((o) => (
        <Checkbox
          key={o.id}
          checked={draf.includes(o.id)}
          onChange={(v) => setDraf((d) => (v ? [...d, o.id] : d.filter((x) => x !== o.id)))}
          label={o.name}
        />
      ))}
      <Button
        title="Selesai"
        onPress={() => {
          onSimpan(draf);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

export function SheetLabel({
  visible,
  onClose,
  label,
  terpilih,
  onSimpan,
}: {
  visible: boolean;
  onClose: () => void;
  label: LabelTugas[];
  terpilih: string[];
  onSimpan: (ids: string[]) => void;
}): React.JSX.Element {
  const { dark } = useTheme();
  const [draf, setDraf] = useState<string[]>(terpilih);
  const [terakhir, setTerakhir] = useState(visible);
  if (visible !== terakhir) {
    setTerakhir(visible);
    if (visible) {
      setDraf(terpilih);
    }
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Label" showClose scrollable>
      {label.length === 0 ? <Text variant="body" tone="muted">Workspace ini belum punya label. Label dibuat di pengaturan workspace (desktop).</Text> : null}
      {label.map((l) => (
        <Pressable
          key={l.id}
          scaleTo={1}
          onPress={() => setDraf((d) => (d.includes(l.id) ? d.filter((x) => x !== l.id) : [...d, l.id]))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draf.includes(l.id) }}
          accessibilityLabel={l.name}
          style={s.baris}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: warnaPalet(l.color, dark) }} />
          <Text variant="title" style={{ flex: 1 }}>
            {l.name}
          </Text>
          {draf.includes(l.id) ? <Icon name="check" size={22} /> : null}
        </Pressable>
      ))}
      <Button
        title="Selesai"
        onPress={() => {
          onSimpan(draf);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/** Tenggat cepat: Hari ini · Besok · Lusa · Pekan depan · Pilih tanggal · Hapus. */
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
}): React.JSX.Element {
  const [pilih, setPilih] = useState(false);
  const p = tanggal.parseIso(hariIni);
  const ke = p ? (tanggal.hariKe(p) + 6) % 7 : 0; // 0 = Senin
  const pekanDepan = tambahHari(hariIni, 7 - ke);
  const opsi: { judul: string; iso: string; icon: 'sun' | 'calendar-plus' | 'calendar-arrow-down' }[] = [
    { judul: 'Hari ini', iso: hariIni, icon: 'sun' },
    { judul: 'Besok', iso: tambahHari(hariIni, 1), icon: 'calendar-plus' },
    { judul: 'Lusa', iso: tambahHari(hariIni, 2), icon: 'calendar-plus' },
    { judul: 'Pekan depan', iso: pekanDepan, icon: 'calendar-arrow-down' },
  ];
  const tutup = (): void => {
    setPilih(false);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={tutup} title={judul} showClose>
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
      <BarisPilihan judul="Pilih tanggal…" leading={<Icon name="calendar-search" size={22} />} onPress={() => setPilih((v) => !v)} />
      {pilih ? (
        <DateInput
          value={nilai ?? ''}
          min={min}
          required
          onChange={(iso) => {
            if (iso) {
              onPilih(iso);
              tutup();
            }
          }}
        />
      ) : null}
      {boleKosongkan && nilai ? (
        <BarisPilihan
          judul="Hapus tenggat"
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
  nilai,
  onPilih,
  onTerkunci,
}: {
  visible: boolean;
  onClose: () => void;
  kelompok: KelompokWorkspaceTugas[];
  nilai: string | null;
  onPilih: (w: OpsiWorkspace) => void;
  onTerkunci: (w: OpsiWorkspace, alasan: string) => void;
}): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih workspace" showClose scrollable>
      <Text variant="meta">Hanya yang boleh Anda isi tugas</Text>
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
});
