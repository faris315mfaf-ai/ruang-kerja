import { Link } from '@inertiajs/react';
import { CalendarRange, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLongDate } from '@/lib/format';
import { PageHeader } from './dashboard-ui';
import {
    AttendanceSummaryPanel,
    HiringCard,
    PendingHrPanel,
} from './hr-summary';
import type { HrProps } from './hr-types';
import { LiveBadge } from './live-badge';
import { ViewPicker } from './view-picker';

/** "48 karyawan terjadwal hari ini · 40 Reguler · 8 Pagi". */
export function hrSubtitle(props: HrProps): string {
    const { attendance } = props;
    const shifts = attendance.shifts
        .map((shift) => `${shift.count} ${shift.name}`)
        .join(' · ');

    return [
        `${attendance.counts.scheduled} karyawan terjadwal hari ini`,
        shifts || null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Dashboard HR, desktop & tablet. Keputusan pemilik 6 Okt 2026: requests
 * waiting for HR, today's attendance numbers (details in Absensi) and the
 * Hiring card; the announcement banner sits above every dashboard.
 */
export function HrDesktop({ live, ...props }: HrProps & { live: boolean }) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                overline={formatLongDate(props.today)}
                title="Dashboard HR"
                subtitle={hrSubtitle(props)}
            >
                <Button asChild variant="outline">
                    <Link href="/absensi/rekap">
                        <CalendarRange aria-hidden />
                        Rekap absensi
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <a href={props.exportUrl} download>
                        <Download aria-hidden />
                        Ekspor
                    </a>
                </Button>
            </PageHeader>
            <ViewPicker views={props.views} />

            <section className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[1.4_1_560px] flex-col gap-5">
                    <PendingHrPanel pending={props.pending} />
                    <AttendanceSummaryPanel
                        attendance={props.attendance}
                        live={<LiveBadge live={live} />}
                    />
                </div>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
                    <HiringCard href={props.hiring} />
                </div>
            </section>
        </div>
    );
}
