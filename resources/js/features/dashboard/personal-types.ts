import type {
    DashboardSharedProps,
    PersonalLive,
    PersonalMetrics,
} from '@/types/dashboard';
import type { LatestBriefingData } from '@/features/briefings/types';
import type { TugasHariIniPayload } from './tugas-hari-ini/types';

export type PersonalProps = DashboardSharedProps & {
    live: PersonalLive;
    /**
     * "Briefing terakhir" for every viewer (keputusan pemilik 9 Okt 2026);
     * null = none recorded yet. Optional until every server sends it.
     */
    latestBriefing?: LatestBriefingData | null;
    /**
     * Kartu "Tugas hari ini" (keputusan pemilik 9 Okt 2026): tugas jatuh
     * tempo hari ini dalam segmen pribadi · tim · semua.
     */
    tugasHariIni: TugasHariIniPayload;
    /** Deferred: undefined until loaded (skeleton). */
    metrics?: PersonalMetrics;
};
