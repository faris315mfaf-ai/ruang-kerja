import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { HolidaysSection } from '@/features/attendance/admin/holidays-section';
import { LocationsSection } from '@/features/attendance/admin/locations-section';
import { ShiftsSection } from '@/features/attendance/admin/shifts-section';
import type { AttendanceSettingsProps } from '@/features/attendance/admin/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

const SECTIONS = [
    { id: 'lokasi', label: 'Lokasi' },
    { id: 'shift', label: 'Shift' },
    { id: 'hari-libur', label: 'Hari libur' },
] as const;

/** Admin › Lokasi, shift & hari libur (HR). Desktop only (docs/PLATFORM.md §3). */
export default function AttendanceSettings(props: AttendanceSettingsProps) {
    const breakpoint = useBreakpoint();
    const [active, setActive] = useState<string>('lokasi');

    if (breakpoint === null) {
        return <Skeleton className="h-96 rounded-xl" />;
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
            <div className="space-y-5">
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Lokasi, shift &amp; hari libur
                        </h1>
                        <p className="text-sm text-text-muted">
                            Dasar perhitungan absensi: di mana karyawan boleh
                            check-in, jam kerjanya, dan hari yang tidak
                            dihitung.
                        </p>
                    </div>
                    <nav
                        aria-label="Bagian halaman"
                        className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1"
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
                                    'rounded-md px-3 py-1 text-[13px] transition-colors duration-120 ease-brand',
                                    active === section.id
                                        ? 'bg-surface font-medium text-text shadow-card'
                                        : 'text-text-muted hover:text-text',
                                )}
                            >
                                {section.label}
                            </a>
                        ))}
                    </nav>
                </header>
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
            </div>
        </>
    );
}

AttendanceSettings.layout = {
    breadcrumbs: [
        { title: 'Admin', href: '/admin/absensi' },
        { title: 'Lokasi, shift & hari libur', href: '/admin/absensi' },
    ],
    title: 'Lokasi & shift',
    back: '/menu',
};
