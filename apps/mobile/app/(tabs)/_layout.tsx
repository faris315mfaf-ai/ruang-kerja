/**
 * Tab bawah: Beranda · Tugas · tombol tengah kontekstual (Absen ⇄ Workspace)
 * · Obrolan (atau Inbox bila Obrolan mati) · Lainnya. Kapsul melayang —
 * lihat `@/ui/TabBar`. Layar di dalam tabs otomatis menyisakan ruang bawah
 * lewat `Screen` (`useTabBarSpace`).
 */
import { Tabs } from 'expo-router';

import { AttendanceStatusProvider, TabBar, TabBarSpaceProvider } from '@/ui';

export default function TabsLayout(): React.JSX.Element {
  return (
    <AttendanceStatusProvider>
      <TabBarSpaceProvider>
        <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
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
