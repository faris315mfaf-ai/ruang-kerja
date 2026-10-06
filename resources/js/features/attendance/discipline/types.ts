import type {
    ComparedMetric,
    ComparedPeriods,
    DashboardFilterState,
    MetricDefinitions,
    PeriodInfo,
    TrendPoint,
} from '@/types/dashboard';

/** One row of "Per orang" (AttendanceDisciplineReport::people). */
export type DisciplinePerson = {
    user: {
        id: string;
        name: string;
        avatar: string | null;
        division: string | null;
    };
    /** Scheduled work days so far in the period. */
    scheduled: number;
    on_time: number;
    /** Kedisiplinan hadir in percent; null without scheduled days. */
    discipline: number | null;
    late_days: number;
    /** Minutes; null without late days. */
    average_late: number | null;
    absent_days: number;
};

export type DisciplineReport = {
    period: PeriodInfo;
    compared: ComparedPeriods;
    kpis: {
        attendance_discipline: ComparedMetric;
        average_lateness: ComparedMetric;
        absent_days: ComparedMetric;
        late_days: ComparedMetric;
        completion_rate: ComparedMetric;
        lead_time: ComparedMetric;
    };
    trend: TrendPoint[];
    people: DisciplinePerson[];
};

/** Props of /absensi/kedisiplinan (AttendanceDisciplineController). */
export type DisciplinePageProps = {
    filters: DashboardFilterState;
    scope: { label: string; member_count: number };
    definitions: MetricDefinitions;
    exportUrl: string;
    /** Deferred: undefined until loaded (skeleton). */
    report?: DisciplineReport;
};
