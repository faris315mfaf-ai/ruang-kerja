import { TabNav } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type AttendanceTab = 'today' | 'recap' | 'discipline';

export const ATTENDANCE_TABS: {
    tab: AttendanceTab;
    label: string;
    href: string;
}[] = [
    { tab: 'today', label: 'Hari ini', href: '/absensi/hari-ini' },
    { tab: 'recap', label: 'Rekap', href: '/absensi/rekap' },
    { tab: 'discipline', label: 'Kedisiplinan', href: '/absensi/kedisiplinan' },
];

/**
 * Absensi module tabs for HR, Direksi, Super Admin and team leads
 * (keputusan pemilik 6 Okt 2026): Hari ini · Rekap · Kedisiplinan. Each tab
 * is its own page (bookmarkable, filters in the URL).
 */
export function AttendanceTabs({
    active,
    mobile = false,
    className,
}: {
    active: AttendanceTab;
    mobile?: boolean;
    className?: string;
}) {
    return (
        <TabNav
            label="Bagian absensi"
            items={ATTENDANCE_TABS.map((item) => ({
                href: item.href,
                label: item.label,
                active: item.tab === active,
            }))}
            className={cn(
                mobile
                    ? '-mx-4 gap-6 px-4 [&>a]:min-h-11'
                    : '[&>a]:text-[17px]',
                className,
            )}
        />
    );
}
