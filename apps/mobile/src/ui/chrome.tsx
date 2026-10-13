/**
 * Konteks "kerangka": apakah kapsul tab bar sedang tampil (supaya snackbar
 * dan FAB naik di atasnya) dan ruang yang ia butuhkan di bawah konten.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/theme';

interface ChromeValue {
  tabBarVisible: boolean;
  setTabBarVisible: (tampil: boolean) => void;
}

const ChromeContext = createContext<ChromeValue>({ tabBarVisible: false, setTabBarVisible: () => undefined });

export function ChromeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [tabBarVisible, setState] = useState(false);
  const setTabBarVisible = useCallback((tampil: boolean) => setState(tampil), []);
  const value = useMemo(() => ({ tabBarVisible, setTabBarVisible }), [tabBarVisible, setTabBarVisible]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeValue {
  return useContext(ChromeContext);
}

/** Tinggi total kapsul + jarak ke tepi (tanpa inset aman). */
export const TAB_BAR_SPACE = layout.tabBar + layout.tabLift + layout.tabRaise;

const TabBarSpaceContext = createContext(false);

/**
 * Dipasang di layout (tabs): layar di dalamnya perlu padding bawah untuk kapsul
 * yang melayang. `aktif={false}` saat Rail tablet dipakai (tanpa kapsul) —
 * pohon tetap sama supaya navigator tidak dipasang ulang saat lebar berubah.
 */
export function TabBarSpaceProvider({ children, aktif = true }: { children: React.ReactNode; aktif?: boolean }): React.JSX.Element {
  return <TabBarSpaceContext.Provider value={aktif}>{children}</TabBarSpaceContext.Provider>;
}

/** Ruang bawah yang harus disisakan konten (0 di luar tabs). Sudah termasuk inset gestur. */
export function useTabBarSpace(): number {
  const dalamTabs = useContext(TabBarSpaceContext);
  const insets = useSafeAreaInsets();
  return dalamTabs ? TAB_BAR_SPACE + insets.bottom : 0;
}
