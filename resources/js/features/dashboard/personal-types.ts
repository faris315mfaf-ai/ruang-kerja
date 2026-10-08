import type {
    DashboardSharedProps,
    PersonalLive,
    PersonalMetrics,
} from '@/types/dashboard';
import type { TugasHariIniPayload } from './tugas-hari-ini/types';

export type PersonalProps = DashboardSharedProps & {
    live: PersonalLive;
    /**
     * Kartu "Tugas hari ini" (keputusan pemilik 9 Okt 2026): tugas jatuh
     * tempo hari ini dalam segmen pribadi · tim · semua.
     */
    tugasHariIni: TugasHariIniPayload;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: PersonalMetrics;
};
