/** Deep link /dashboard/hr → tab Beranda dengan tampilan HR. */
import { Redirect } from 'expo-router';

export default function DashboardHr(): React.JSX.Element {
  return <Redirect href={{ pathname: '/', params: { tampilan: 'hr' } }} />;
}
