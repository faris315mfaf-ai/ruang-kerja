/**
 * Shim kompatibilitas: komponen UI dasar kini ada di `@/ui` (pustaka Arus
 * Fondasi UI). Berkas ini hanya meneruskan ekspor lama supaya layar yang
 * ada tetap berjalan; kode baru mengimpor dari '@/ui'.
 */
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export { SafeAreaProvider, SafeAreaView, useSafeAreaInsets };

export {
  Badge,
  Body,
  Button,
  Card,
  CardTitle,
  Chevron,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Meta,
  Row,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/ui';
export type { Tone } from '@/ui';
