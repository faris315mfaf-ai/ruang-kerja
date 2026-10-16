/**
 * Hiring (mockup 11 › 07–12, keadaan 09): tab bergaris bawah Kandidat ·
 * Lowongan · Pengaturan (Pengaturan hanya HR/SA). `?tab=` dan `?lowongan=`
 * opsional. Data pelamar hanya di memori layar (tidak di-cache ke disk).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { aksesHiring, type RingkasHiring } from '@/api/hiring';
import { HalamanTidakDitemukan, KepalaHiring, type TabHiring } from '@/features/hiring/parts';
import { TabKandidat } from '@/features/hiring/TabKandidat';
import { TabLowongan } from '@/features/hiring/TabLowongan';
import { TabPengaturan } from '@/features/hiring/TabPengaturan';

function bacaTab(nilai: string | undefined): TabHiring {
  return nilai === 'lowongan' || nilai === 'pengaturan' ? nilai : 'kandidat';
}

export default function HiringLayar(): React.JSX.Element {
  const param = useLocalSearchParams<{ tab?: string; lowongan?: string }>();
  const [tab, setTab] = useState<TabHiring>(bacaTab(param.tab));
  const [lowongan, setLowongan] = useState<string | null>(typeof param.lowongan === 'string' && param.lowongan !== '' ? param.lowongan : null);
  const [hiring, setHiring] = useState<RingkasHiring | null>(null);
  const [tanpaAkses, setTanpaAkses] = useState(false);

  // Ringkasan kepala + bendera tab Pengaturan sebelum tab mana pun selesai dimuat (hanya angka, tanpa data pelamar).
  useEffect(() => {
    let aktif = true;
    aksesHiring()
      .then((a) => {
        if (!aktif) {
          return;
        }
        if (!a.has_access) {
          setTanpaAkses(true);
        } else if (a.counts) {
          const counts = a.counts;
          setHiring((lama) => lama ?? { can_manage: a.can_manage, counts });
        }
      })
      .catch(() => undefined);
    return () => {
      aktif = false;
    };
  }, []);

  const gantiTab = useCallback((t: TabHiring) => {
    setTab(t);
    router.setParams({ tab: t });
  }, []);

  const terimaHiring = useCallback((h: RingkasHiring) => {
    setHiring((lama) => (lama && lama.can_manage === h.can_manage && JSON.stringify(lama.counts) === JSON.stringify(h.counts) ? lama : h));
  }, []);

  if (tanpaAkses) {
    return <HalamanTidakDitemukan />;
  }

  const header = <KepalaHiring tab={tab} onTab={gantiTab} hiring={hiring} memuat={hiring === null} />;

  if (tab === 'lowongan') {
    return (
      <TabLowongan
        header={header}
        onHiring={terimaHiring}
        onLihatKandidat={(id) => {
          setLowongan(id);
          gantiTab('kandidat');
        }}
      />
    );
  }
  if (tab === 'pengaturan' && hiring?.can_manage !== false) {
    return <TabPengaturan header={header} />;
  }
  return <TabKandidat header={header} lowonganAwal={lowongan} onHiring={terimaHiring} onKeLowongan={() => gantiTab('lowongan')} />;
}
