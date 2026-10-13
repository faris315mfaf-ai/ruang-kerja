/** Deep link /dashboard/divisi → tab Beranda dengan tampilan Kepala Divisi. */
import { Redirect } from 'expo-router';

export default function DashboardDivisi(): React.JSX.Element {
  return <Redirect href={{ pathname: '/', params: { tampilan: 'divisi' } }} />;
}
