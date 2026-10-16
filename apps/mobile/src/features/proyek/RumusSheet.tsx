/**
 * "Dari mana angka ini?" (mockup 06 › 10): penjelasan rumus PRD M10 — progres
 * aktual, rencana, selisih, dan penanda sistem — dengan angka proyek saat ini.
 * Status kesehatan ditetapkan PIC, bukan dihitung.
 */
import { View } from 'react-native';

import type { BarisProyek } from '@/api/proyek';
import { BottomSheet, Text } from '@/ui';

import { angka, persen, poin, tglBulan } from './format';

function Butir({ judul, isi }: { judul: string; isi: string }): React.JSX.Element {
  return (
    <View style={{ gap: 4 }}>
      <Text variant="title">{judul}</Text>
      <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
        {isi}
      </Text>
    </View>
  );
}

export function RumusSheet({ proyek, visible, onClose }: { proyek: BarisProyek | null; visible: boolean; onClose: () => void }): React.JSX.Element {
  const m = proyek?.metrics;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Dari mana angka ini?" showClose scrollable>
      {proyek && m ? (
        <View style={{ gap: 16 }}>
          <Butir
            judul={`Progres aktual · ${persen(m.actual)}`}
            isi={
              m.uses_estimates
                ? `Jam estimasi tugas selesai dibagi total jam estimasi tugas yang tidak dibatalkan (dipakai karena ≥ 80% tugas punya estimasi). Saat ini ${angka(m.done)} dari ${angka(m.scope)} tugas selesai.`
                : `Tugas selesai dibagi semua tugas yang tidak dibatalkan: ${angka(m.done)} dari ${angka(m.scope)}.`
            }
          />
          <Butir
            judul={`Progres rencana · ${persen(m.planned)}`}
            isi={`Bagian waktu yang sudah berlalu antara tanggal mulai (${tglBulan(proyek.start_date)}) dan target (${tglBulan(proyek.target_date)}), dibatasi 0–100%.`}
          />
          <Butir judul={`Selisih · ${poin(m.variance)}`} isi="Progres aktual dikurangi progres rencana, dalam poin persentase." />
          <Butir
            judul="Penanda sistem"
            isi="Muncul otomatis bila selisih ≤ −15 poin (Tertinggal), ada milestone yang lewat target dan belum selesai (Milestone terlewat), atau update terakhir PIC lebih dari 7 hari (Update kedaluwarsa)."
          />
          <Butir judul="Status kesehatan" isi="Sesuai jalur · Berisiko · Bermasalah ditetapkan PIC di update proyek, bukan dihitung. Penanda sistem tampil di sebelahnya agar penilaian PIC dan fakta data terlihat bersama." />
        </View>
      ) : null}
    </BottomSheet>
  );
}
