/** Buat cepat sebagai layar penuh — entri menu Lainnya (padanan tekan lama tombol tengah tab bar). */
import { Screen, SubAppBar } from '@/ui';
import { BuatCepatIsi } from '@/ui/BuatCepatSheet';

export default function LayarBuatCepat(): React.JSX.Element {
  return (
    <Screen header={<SubAppBar title="Buat cepat" />} contentStyle={{ paddingTop: 12 }}>
      <BuatCepatIsi />
    </Screen>
  );
}
