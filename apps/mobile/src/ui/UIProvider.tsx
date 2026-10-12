/**
 * Pembungkus sekali di akar: gestur, sheet, dialog, snackbar. Selalu
 * terpasang (jangan bersyarat). Urutannya: GestureHandlerRoot → Chrome →
 * BottomSheetModalProvider → Snackbar → Dialog.
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ChromeProvider } from './chrome';
import { DialogProvider } from './Dialog';
import { SnackbarProvider } from './Snackbar';

export function UIProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.akar}>
      <ChromeProvider>
        <BottomSheetModalProvider>
          <SnackbarProvider>
            <DialogProvider>{children}</DialogProvider>
          </SnackbarProvider>
        </BottomSheetModalProvider>
      </ChromeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ akar: { flex: 1 } });
