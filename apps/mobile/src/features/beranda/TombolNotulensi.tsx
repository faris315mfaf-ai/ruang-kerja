/**
 * "Mulai notulensi" (Beranda & dashboard): POST /catatan/notulensi (templat
 * paragraf polos) lalu buka editor dalam mode catat — logika bersama di
 * `useMulaiNotulensi` (fitur Catatan). Hanya tampil bila fitur Catatan aktif.
 */
import { useMulaiNotulensi } from '@/features/catatan/useMulaiNotulensi';
import { Button } from '@/ui';

export function TombolNotulensi(): React.JSX.Element {
  const { mulai, membuat } = useMulaiNotulensi();

  return <Button title="Mulai notulensi" variant="tonal" icon="notebook-pen" loading={membuat} loadingTitle="Membuat catatan…" onPress={() => void mulai()} />;
}
