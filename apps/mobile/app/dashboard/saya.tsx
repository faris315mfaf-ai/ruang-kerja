/** Deep link /dashboard/saya → tab Beranda dengan tampilan Saya. */
import { Redirect } from 'expo-router';

export default function DashboardSaya(): React.JSX.Element {
  return <Redirect href={{ pathname: '/', params: { tampilan: 'saya' } }} />;
}
