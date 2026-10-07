import type {
    DashboardSharedProps,
    PersonalLive,
    PersonalMetrics,
} from '@/types/dashboard';
import type { TodayReportStatus } from '@/features/reports/types';
import type { Planner } from './ruang-saya/types';

export type PersonalProps = DashboardSharedProps & {
    live: PersonalLive;
    /** "Ruang saya" (App\Domain\Planner), live, private to the viewer. */
    planner: Planner;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: PersonalMetrics;
    /** Kartu "Laporan hari ini" (keputusan pemilik 6 Okt 2026). */
    dailyReport?: TodayReportStatus;
};
