/**
 * Beranda Direksi = monitoring kerja (mockup 06 › 35–39; keputusan pemilik:
 * monitoring sebagai Beranda Direksi): tab Harian · Mingguan · Proyek ·
 * Catatan, persis web. Dipasang di `app/(tabs)/index.tsx` saat tampilan
 * "Direksi" dipilih. Tanpa ekspor (desktop).
 */
import { useState } from 'react';
import { View } from 'react-native';

import type { DasborProps } from '@/features/beranda/DasborDivisi';
import { CatatanTindakanDaftar } from '@/features/manajemen/CatatanTindakan';
import { SegmentedTabs } from '@/ui';

import { TabHarian } from './TabHarian';
import { TabMingguan } from './TabMingguan';
import { TabProyek } from './TabProyek';

type Tab = 'harian' | 'mingguan' | 'proyek' | 'catatan';

export function DasborDireksi({ kepala, registrasiMuat }: DasborProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('harian');
  const [kunciCatatan, setKunciCatatan] = useState(0);
  return (
    <View style={{ gap: 16 }}>
      {kepala({ judul: 'Monitoring kerja', subjudul: 'Seluruh perusahaan' })}
      <SegmentedTabs<Tab>
        value={tab}
        onChange={(t) => {
          if (t === 'catatan') setKunciCatatan((n) => n + 1);
          setTab(t);
        }}
        options={[
          { value: 'harian', label: 'Harian' },
          { value: 'mingguan', label: 'Mingguan' },
          { value: 'proyek', label: 'Proyek' },
          { value: 'catatan', label: 'Catatan' },
        ]}
      />
      {tab === 'harian' ? (
        <TabHarian registrasiMuat={registrasiMuat} />
      ) : tab === 'mingguan' ? (
        <TabMingguan registrasiMuat={registrasiMuat} />
      ) : tab === 'proyek' ? (
        <TabProyek registrasiMuat={registrasiMuat} />
      ) : (
        <CatatanTindakanDaftar key={kunciCatatan} />
      )}
    </View>
  );
}
