/**
 * Tab bawah: Beranda · Tugas · tombol tengah kontekstual (Absen ⇄ Workspace)
 * · Obrolan (atau Inbox bila Obrolan mati) · Lainnya. Kapsul melayang —
 * lihat `@/ui/TabBar`. Layar di dalam tabs otomatis menyisakan ruang bawah
 * lewat `Screen` (`useTabBarSpace`).
 *
 * Jendela ≥ 600 dp (tablet, lipat terbuka): kapsul diganti Rail 96 dp di kiri
 * (`@/ui/Rail`) dan konten tidak perlu ruang bawah. Navigator, rute, dan data
 * tetap sama — hanya kerangka yang berganti mengikuti lebar jendela.
 */
import { Tabs } from 'expo-router';

import { AttendanceStatusProvider, Rail, TabBar, TabBarSpaceProvider, useTataLetak } from '@/ui';

export default function TabsLayout(): React.JSX.Element {
  const { rail } = useTataLetak();
  return (
    <AttendanceStatusProvider>
      <TabBarSpaceProvider aktif={!rail}>
        <Tabs
          tabBar={(props) => (rail ? <Rail {...props} /> : <TabBar {...props} />)}
          screenOptions={{ headerShown: false, tabBarPosition: rail ? 'left' : 'bottom' }}
        >
          <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
          <Tabs.Screen name="tugas" options={{ title: 'Tugas' }} />
          <Tabs.Screen name="absen" options={{ title: 'Absen' }} />
          <Tabs.Screen name="obrolan" options={{ title: 'Obrolan' }} />
          <Tabs.Screen name="lainnya" options={{ title: 'Lainnya' }} />
        </Tabs>
      </TabBarSpaceProvider>
    </AttendanceStatusProvider>
  );
}
