import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/features/admin/page-header';
import { HolidaysSection } from '@/features/attendance/admin/holidays-section';
import { KiosksSection } from '@/features/attendance/admin/kiosks-section';
import { LocationsSection } from '@/features/attendance/admin/locations-section';
import { ShiftsSection } from '@/features/attendance/admin/shifts-section';
import type { AttendanceSettingsProps } from '@/features/attendance/admin/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn, focusRing } from '@/lib/utils';

const SECTIONS = [
    { id: 'lokasi', label: 'Lokasi' },
    { id: 'shift', label: 'Shift' },
    { id: 'hari-libur', label: 'Hari libur' },
    { id: 'kiosk', label: 'Kiosk QR' },
] as const;

/** Admin › Lokasi, shift & hari libur (HR). Desktop only (docs/PLATFORM.md §3). */
export default function AttendanceSettings(props: AttendanceSettingsProps) {
    const breakpoint = useBreakpoint();
    const [active, setActive] = useState<string>('lokasi');

    if (breakpoint === null) {
        return <Skeleton className="h-96 rounded-panel" />;
    }

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Lokasi, shift & hari libur" />
                <DesktopOnlyNotice feature="Pengaturan lokasi, shift, dan hari libur" />
            </>
        );
    }

    return (
        <>
            <Head title="Lokasi, shift & hari libur" />
            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    overline="Admin · Absensi"
                    title="Lokasi, shift & hari libur"
                    description="Dasar perhitungan absensi: di mana karyawan boleh check-in, jam kerjanya, dan hari yang tidak dihitung."
                    actions={
                        <nav
                            aria-label="Bagian halaman"
                            className="flex gap-1 rounded-[14px] bg-surface-2 p-1"
                        >
                            {SECTIONS.map((section) => (
                                <a
                                    key={section.id}
                                    href={`#${section.id}`}
                                    onClick={() => setActive(section.id)}
                                    aria-current={
                                        active === section.id
                                            ? 'location'
                                            : undefined
                                    }
                                    className={cn(
                                        'inline-flex h-[38px] items-center rounded-[10px] px-4 text-[15px] font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] duration-120 ease-brand',
                                        focusRing,
                                        active === section.id
                                            ? 'bg-surface text-text shadow-segment'
                                            : 'text-text-muted hover:text-text',
                                    )}
                                >
                                    {section.label}
                                </a>
                            ))}
                        </nav>
                    }
                />
                <LocationsSection
                    locations={props.locations}
                    geofence={props.geofence}
                />
                <ShiftsSection
                    shifts={props.shifts}
                    locations={props.locations}
                    shiftDefaults={props.shiftDefaults}
                />
                <HolidaysSection
                    holidays={props.holidays}
                    holidayYear={props.holidayYear}
                    holidayYears={props.holidayYears}
                    holidayTypes={props.holidayTypes}
                />
                <KiosksSection
                    kiosks={props.kiosks}
                    locations={props.locations}
                />
            </div>
        </>
    );
}

AttendanceSettings.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Admin', href: '/admin/absensi' },
        { title: 'Lokasi, shift & hari libur', href: '/admin/absensi' },
    ],
    title: 'Lokasi & shift',
    back: '/menu',
};
