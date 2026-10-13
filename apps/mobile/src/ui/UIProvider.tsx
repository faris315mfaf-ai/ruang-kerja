/**
 * Pembungkus sekali di akar: gestur, dialog, snackbar. Selalu terpasang
 * (jangan bersyarat). Urutannya: GestureHandlerRoot → Chrome → Snackbar →
 * Dialog. BottomSheetModalProvider sengaja TIDAK di sini: dipasang di
 * `app/_layout.tsx` di dalam provider sesi, karena isi lembar dirender di host
 * portal provider itu dan butuh konteks sesi.
 */
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ChromeProvider } from './chrome';
import { DialogProvider } from './Dialog';
import { SnackbarProvider } from './Snackbar';

export function UIProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.akar}>
      <ChromeProvider>
        <SnackbarProvider>
          <DialogProvider>{children}</DialogProvider>
        </SnackbarProvider>
      </ChromeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ akar: { flex: 1 } });
