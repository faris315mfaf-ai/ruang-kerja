/**
 * Absensi tim (mockup 11 › 19–23): tab bergaris bawah Hari ini · Rekap ·
 * Kedisiplinan. Judul "Absensi divisi" untuk Kepala Divisi. Cakupan & aksi
 * dari server (`can`). `?tab=hari-ini|rekap|kedisiplinan`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { usePeranHr } from '@/features/hr/akses';
import { TabHariIni } from '@/features/hr/absensi/TabHariIni';
import { TabKedisiplinan } from '@/features/hr/absensi/TabKedisiplinan';
import { TabRekap } from '@/features/hr/absensi/TabRekap';
import { SubAppBar, TabNav } from '@/ui';

type Tab = 'hari-ini' | 'rekap' | 'kedisiplinan';
const TAB: Tab[] = ['hari-ini', 'rekap', 'kedisiplinan'];

export default function AbsensiTimLayar(): React.JSX.Element {
  const param = useLocalSearchParams<{ tab?: string }>();
  const peran = usePeranHr();
  const [tab, setTab] = useState<Tab>(TAB.includes(param.tab as Tab) ? (param.tab as Tab) : 'hari-ini');
  const judulTab = tab === 'rekap' ? 'Rekap absensi' : tab === 'kedisiplinan' ? 'Kedisiplinan' : null;
  const judul = judulTab ?? (peran.perusahaan ? 'Absensi tim' : peran.kadiv ? 'Absensi divisi' : 'Absensi tim');
  const ganti = (t: Tab): void => {
    setTab(t);
    router.setParams({ tab: t });
  };
  const header = (
    <View>
      <SubAppBar title={judul} />
      <TabNav
        value={tab}
        onChange={ganti}
        options={[
          { value: 'hari-ini', label: 'Hari ini' },
          { value: 'rekap', label: 'Rekap' },
          { value: 'kedisiplinan', label: 'Kedisiplinan' },
        ]}
      />
    </View>
  );
  const cakupan = peran.perusahaan ? 'Semua karyawan' : peran.kadiv ? 'Divisi Anda' : 'Bawahan langsung';

  if (tab === 'rekap') return <TabRekap header={header} />;
  if (tab === 'kedisiplinan') return <TabKedisiplinan header={header} />;
  return <TabHariIni header={header} judulCakupan={cakupan} onBukaRekap={() => ganti('rekap')} />;
}
