import type {
    MissingCheckOut,
    Option,
    SuspiciousLog,
    TodayBoardData,
} from '@/types/attendance';

export type BoardPageProps = {
    filters: { lokasi: string | null };
    locations: Option[];
    divisions: Option[];
    board: TodayBoardData;
    suspicious: { total: number; items: SuspiciousLog[] };
    missingCheckOut: MissingCheckOut[];
    channels: { company: boolean; divisions: string[] };
    can: { correct: boolean; recap: boolean };
};
