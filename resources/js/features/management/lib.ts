import { formatPercent, formatTime } from '@/lib/format';
import type {
    AttendanceToday,
    ChartColumn,
    ManagementPortfolio,
    MilestoneState,
    PeriodBlock,
    PeriodKey,
    ProjectHealth,
    ProjectRow,
} from './types';

/** Tab labels, in design order. */
export const PERIOD_LABELS: Record<PeriodKey, string> = {
    harian: 'Harian',
    mingguan: 'Mingguan',
    bulanan: 'Bulanan',
};

/** Tallest bar of the work chart (px), as in the design (250px area). */
export const CHART_BAR_MAX = 190;

/** Smallest visible bar for a non-zero value (px). */
const BAR_MIN = 4;

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
];

/**
 * Bar heights (px) of the planned-vs-done chart, scaled to the busiest
 * column. Non-zero values never shrink below a visible sliver; done never
 * outgrows planned.
 */
export function barHeights(
    columns: Pick<ChartColumn, 'planned' | 'done'>[],
    max = CHART_BAR_MAX,
): { planned: number; done: number }[] {
    const top = Math.max(0, ...columns.map((c) => Math.max(c.planned, c.done)));

    if (top === 0) {
        return columns.map(() => ({ planned: 0, done: 0 }));
    }

    const scale = (value: number) =>
        value <= 0 ? 0 : Math.max(BAR_MIN, Math.round((value / top) * max));

    return columns.map((column) => {
        const planned = scale(column.planned);

        return { planned, done: Math.min(planned, scale(column.done)) };
    });
}

/** "Jum, 9 Okt" from an office date "2026-10-09" (no timezone shift). */
export function shortDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return `${WEEKDAYS[weekday]}, ${day} ${MONTHS[month - 1]}`;
}

/** "9 Okt" from "2026-10-09". */
export function dayMonth(date: string): string {
    const [, month, day] = date.split('-').map(Number);

    return `${day} ${MONTHS[month - 1]}`;
}

/** "28 Sep–2 Okt", "7–11 Sep" (no year, as in the header note). */
export function shortRange(from: string, to: string): string {
    const [, fromMonth, fromDay] = from.split('-').map(Number);
    const [, toMonth, toDay] = to.split('-').map(Number);

    if (from === to) {
        return dayMonth(from);
    }

    return fromMonth === toMonth
        ? `${fromDay}–${toDay} ${MONTHS[toMonth - 1]}`
        : `${dayMonth(from)}–${dayMonth(to)}`;
}

/** Header note after "data per 09.40": what the selected tab covers. */
export function periodNote(period: PeriodKey, block?: PeriodBlock): string {
    if (period === 'harian') {
        return 'hari ini';
    }

    const range = block
        ? `, ${shortRange(block.range.from, block.range.to)}`
        : '';

    return period === 'mingguan'
        ? `minggu lalu${range}`
        : `4 minggu terakhir${range}`;
}

function previousLabel(period: PeriodKey): string {
    return period === 'bulanan' ? '4 minggu sebelumnya' : 'minggu sebelumnya';
}

/** "naik 3 poin dari minggu sebelumnya" (percentage points). */
export function deltaPhrase(
    delta: number | null,
    previous: number | null,
    period: PeriodKey,
): string {
    const against = previousLabel(period);

    if (previous === null || delta === null) {
        return `belum ada data ${against}`;
    }

    if (delta === 0) {
        return `sama dengan ${against}`;
    }

    const points = Math.abs(delta).toLocaleString('id-ID');

    return `${delta > 0 ? 'naik' : 'turun'} ${points} poin dari ${against}`;
}

/** "PLQ berisiko · KTR milestone terlewat · +1 lainnya". */
export function attentionNote(
    attention: ManagementPortfolio['attention'],
    shown = 2,
): string {
    if (attention.count === 0) {
        return 'Semua proyek aktif sesuai jalur';
    }

    const parts = attention.items
        .slice(0, shown)
        .map((item) => `${item.key} ${item.reason}`);
    const rest = attention.count - Math.min(shown, attention.items.length);

    return rest > 0
        ? [...parts, `+${rest} lainnya`].join(' · ')
        : parts.join(' · ');
}

export type KpiTone = 'highlight' | 'plain' | 'warm';

export type KpiCard = {
    key: string;
    label: string;
    value: string;
    note: string;
    tone: KpiTone;
    /** Danger accent for the value (overdue tasks on mobile tiles). */
    alert?: boolean;
};

function pct(value: number | null): string {
    return formatPercent(value, 0);
}

/** First KPI: today's presence, or the average attendance of the period. */
export function attendanceCard(block: PeriodBlock): KpiCard {
    const attendance = block.attendance;

    if (attendance.kind === 'today') {
        const notes = [
            pct(attendance.rate),
            `${attendance.late} terlambat`,
            `${attendance.not_checked_in} belum check-in`,
        ];

        return {
            key: 'attendance',
            label: 'Kehadiran',
            value:
                attendance.scheduled === 0
                    ? '–'
                    : `${attendance.present}/${attendance.scheduled}`,
            note:
                attendance.scheduled === 0
                    ? 'Tidak ada karyawan terjadwal hari ini'
                    : notes.join(' · '),
            tone: 'highlight',
        };
    }

    return {
        key: 'attendance',
        label: 'Kehadiran rata-rata',
        value: pct(attendance.rate),
        note:
            attendance.scheduled === 0
                ? 'Belum ada hari kerja terjadwal'
                : `${attendance.attended.toLocaleString('id-ID')} dari ${attendance.scheduled.toLocaleString('id-ID')} hari-orang`,
        tone: 'highlight',
    };
}

/** Second KPI: tasks done out of the tasks due in the period. */
export function tasksCard(period: PeriodKey, block: PeriodBlock): KpiCard {
    const { done, planned, rate } = block.tasks;

    return {
        key: 'tasks',
        label: 'Tugas selesai',
        value: done.toLocaleString('id-ID'),
        note:
            period === 'harian'
                ? `dari ${planned.toLocaleString('id-ID')} terjadwal hari ini`
                : `dari ${planned.toLocaleString('id-ID')} rencana${rate === null ? '' : ` · ${pct(rate)}`}`,
        tone: 'plain',
    };
}

/** Third KPI: overdue tasks (harian) or on-time rate with delta. */
export function thirdCard(period: PeriodKey, block: PeriodBlock): KpiCard {
    if (block.overdue) {
        const top = block.overdue.top_division;

        return {
            key: 'overdue',
            label: 'Tugas terlambat',
            value: block.overdue.count.toLocaleString('id-ID'),
            note:
                block.overdue.count === 0
                    ? 'Tidak ada tugas lewat tenggat'
                    : top
                      ? `${top.count.toLocaleString('id-ID')} di ${top.name}`
                      : 'lewat tenggat, belum selesai',
            tone: 'plain',
            alert: block.overdue.count > 0,
        };
    }

    const onTime = block.on_time;

    return {
        key: 'on_time',
        label: 'Tepat waktu',
        value: pct(onTime?.value ?? null),
        note:
            onTime === null || onTime.value === null
                ? 'Belum ada tugas bertenggat yang selesai'
                : deltaPhrase(onTime.delta, onTime.previous, period),
        tone: 'plain',
    };
}

/** Fourth KPI: projects that need attention (needs the portfolio block). */
export function attentionCard(
    attention: ManagementPortfolio['attention'],
): KpiCard {
    return {
        key: 'attention',
        label: 'Proyek perlu perhatian',
        value: attention.count.toLocaleString('id-ID'),
        note: attentionNote(attention),
        tone: 'warm',
    };
}

export const CHART_TITLES: Record<PeriodKey, string> = {
    harian: 'Kerja hari ini per divisi',
    mingguan: 'Kerja harian minggu lalu',
    bulanan: 'Kerja mingguan, 4 minggu terakhir',
};

/**
 * The note under the chart, from the numbers only (no invented causes):
 * progress so far today, or the period total plus its weakest column.
 */
export function chartFoot(
    period: PeriodKey,
    block: PeriodBlock,
    generatedAt?: string | null,
): string {
    const { done, planned, rate } = block.tasks;
    const n = (value: number) => value.toLocaleString('id-ID');

    if (period === 'harian') {
        if (planned === 0) {
            return 'Belum ada tugas bertenggat hari ini.';
        }

        const at = generatedAt ? ` per ${formatTime(generatedAt)}` : '';

        return `Hari masih berjalan: ${n(done)} dari ${n(planned)} tugas terjadwal sudah selesai${at}.`;
    }

    const span =
        period === 'mingguan' ? 'minggu lalu' : 'dalam 4 minggu terakhir';

    if (planned === 0) {
        return `Tidak ada tugas bertenggat ${span}.`;
    }

    const total = `${n(done)} dari ${n(planned)} tugas bertenggat ${span} selesai (${pct(rate)}).`;
    const measured = block.chart.filter((column) => column.planned > 0);

    if (measured.length < 2) {
        return total;
    }

    const ratio = (column: ChartColumn) => column.done / column.planned;
    const lowest = measured.reduce((low, column) =>
        ratio(column) < ratio(low) ? column : low,
    );
    const highest = Math.max(...measured.map(ratio));

    if (ratio(lowest) === highest) {
        return total;
    }

    return `${total} Penyelesaian terendah: ${lowest.label} (${n(lowest.done)} dari ${n(lowest.planned)}).`;
}

/** One-sentence text alternative of the chart (aria-label of the figure). */
export function chartSummary(period: PeriodKey, block: PeriodBlock): string {
    if (block.chart.length === 0) {
        return `${CHART_TITLES[period]}: tidak ada data.`;
    }

    const columns = block.chart
        .map((c) => `${c.full_label} ${c.done} dari ${c.planned}`)
        .join('; ');

    return `${CHART_TITLES[period]}, selesai dari rencana: ${columns}.`;
}

export type Segment = {
    key: 'on_time' | 'late' | 'away' | 'not_checked_in' | 'absent';
    label: string;
    value: number;
    /** Tailwind classes for the bar segment and the legend dot. */
    fill: string;
};

/**
 * Stacked bar of today's attendance. "Alpha" only appears when someone
 * already has it (usually after close-day).
 */
export function attendanceSegments(
    counts: AttendanceToday['counts'],
): Segment[] {
    const segments: Segment[] = [
        {
            key: 'on_time',
            label: 'Tepat waktu',
            value: counts.on_time,
            fill: 'bg-grad-merek-x bg-fill-teal',
        },
        {
            key: 'late',
            label: 'Terlambat',
            value: counts.late,
            fill: 'bg-fill-warning',
        },
        {
            key: 'away',
            label: 'Cuti / izin',
            value: counts.away,
            fill: 'bg-fill-violet',
        },
        {
            key: 'not_checked_in',
            label: 'Belum check-in',
            value: counts.not_checked_in,
            fill: 'bg-border-strong',
        },
    ];

    if (counts.absent > 0) {
        segments.push({
            key: 'absent',
            label: 'Alpha',
            value: counts.absent,
            fill: 'bg-fill-danger',
        });
    }

    return segments;
}

/** Share 0–100 (rounded), 0 when nothing to divide. */
export function share(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const HEALTH: Record<ProjectHealth, { label: string; tone: Tone }> = {
    on_track: { label: 'Sesuai jalur', tone: 'success' },
    at_risk: { label: 'Berisiko', tone: 'warning' },
    off_track: { label: 'Bermasalah', tone: 'danger' },
};

/** Status pill of a project (health set by the PIC). */
export function healthPill(health: ProjectHealth | null): {
    label: string;
    tone: Tone;
} {
    return health
        ? HEALTH[health]
        : { label: 'Belum ada update', tone: 'neutral' };
}

export const TONE_PILL: Record<Tone, string> = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-2 text-text-muted',
};

export const TONE_TEXT: Record<Tone, string> = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-text-muted',
};

/** Progress bar fill per health (design: gradient / amber / red). */
export function progressFill(health: ProjectHealth | null): string {
    switch (health) {
        case 'at_risk':
            return 'bg-fill-warning';
        case 'off_track':
            return 'bg-fill-danger';
        default:
            return 'bg-grad-merek-x';
    }
}

/** Code badge gradient from the workspace palette colour. */
export function projectGradient(color: string): string {
    switch (color) {
        case 'teal':
        case 'green':
            return 'bg-grad-merek';
        case 'violet':
            return 'bg-grad-indigo';
        case 'orange':
        case 'amber':
        case 'red':
        case 'pink':
            return 'bg-grad-hangat';
        default:
            return 'bg-grad-aksi';
    }
}

/** "Divisi · PIC" under the project name. */
export function projectOwner(project: ProjectRow): string {
    return (
        [project.division, project.lead].filter(Boolean).join(' · ') ||
        'Tanpa PIC'
    );
}

/** "Jum, 9 Okt · 2 hari", "Hari ini", "terlewat 2 Okt". */
export function milestoneWhen(
    milestone: NonNullable<ProjectRow['milestone']>,
): {
    text: string;
    late: boolean;
} {
    if (milestone.missed) {
        return {
            text: `terlewat ${dayMonth(milestone.target_date)}`,
            late: true,
        };
    }

    if (milestone.days_left === 0) {
        return {
            text: `${shortDate(milestone.target_date)} · hari ini`,
            late: false,
        };
    }

    return {
        text: `${shortDate(milestone.target_date)} · ${milestone.days_left} hari`,
        late: false,
    };
}

/** Rounded percent for bars, clamped 0–100; null when unknown. */
export function clampPercent(value: number | null): number | null {
    return value === null
        ? null
        : Math.min(100, Math.max(0, Math.round(value)));
}

export const MILESTONE_STATE_LABEL: Record<MilestoneState, string> = {
    done: 'Selesai',
    missed: 'Terlewat',
    next: 'Berikutnya',
    todo: 'Belum',
};
