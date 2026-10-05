import type {
    DashboardSharedProps,
    PersonalLive,
    PersonalMetrics,
} from '@/types/dashboard';

export type PersonalProps = DashboardSharedProps & {
    live: PersonalLive;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: PersonalMetrics;
};
