import { formatLongDate } from '@/lib/format';
import {
    AttendanceSummaryPanel,
    HiringCard,
    PendingHrPanel,
} from './hr-summary';
import type { HrProps } from './hr-types';
import { LiveBadge } from './live-badge';
import { ViewPicker } from './view-picker';

/**
 * Dashboard HR on phones (keputusan pemilik 6 Okt 2026): requests waiting
 * for HR, today's attendance numbers with links into Absensi, Hiring.
 */
export function HrMobile({ live, ...props }: HrProps & { live: boolean }) {
    return (
        <div className="flex flex-col gap-3.5 pb-4">
            <div className="flex flex-col gap-1 px-1">
                <p className="text-overline text-link">
                    {formatLongDate(props.today)}
                </p>
                <p className="text-title">Dashboard HR</p>
                <p className="text-meta text-text-muted">{props.scope.label}</p>
            </div>
            <ViewPicker views={props.views} />
            <PendingHrPanel pending={props.pending} compact />
            <AttendanceSummaryPanel
                attendance={props.attendance}
                live={<LiveBadge live={live} />}
                compact
            />
            <HiringCard href={props.hiring} />
        </div>
    );
}
