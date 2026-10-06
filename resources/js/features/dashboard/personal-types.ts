import type {
    DashboardSharedProps,
    PersonalLive,
    PersonalMetrics,
} from '@/types/dashboard';
import type { Planner } from './ruang-saya/types';

export type PersonalProps = DashboardSharedProps & {
    live: PersonalLive;
    /** "Ruang saya" (App\Domain\Planner), live, private to the viewer. */
    planner: Planner;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: PersonalMetrics;
};
