/**
 * Pure helpers of Ruang HR (/hr): tabs, calendar grid, recipient count,
 * status chips and labels. No React, unit-tested in lib.test.ts.
 */
import type { BadgeTone } from '@/components/ui/badge';
import type {
    ActionKind,
    AssignmentPickers,
    AssignmentRow,
    AssignmentStatus,
    EventKind,
    HubTab,
} from './types';

export const HUB_TABS: readonly { key: HubTab; label: string; href: string }[] =
    [
        { key: 'ringkasan', label: 'Ringkasan', href: '/hr' },
        { key: 'absensi', label: 'Absensi', href: '/hr/absensi' },
        { key: 'monitoring', label: 'Monitoring', href: '/hr/monitoring' },
        { key: 'penugasan', label: 'Penugasan', href: '/hr/penugasan' },
        { key: 'jadwal', label: 'Jadwal', href: '/hr/jadwal' },
        { key: 'catatan', label: 'Catatan', href: '/hr/catatan' },
    ];

/* ------------------------------------------------------------- dates */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDay(day: string): Date {
    const match = ISO_DAY.exec(day);

    if (!match) {
        throw new Error(`Bukan tanggal Y-m-d: ${day}`);
    }

    return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
}

function isoDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** "2026-10-20" + 3 → "2026-10-23" (pure calendar arithmetic, no zones). */
export function addDays(day: string, days: number): string {
    const date = utcDay(day);
    date.setUTCDate(date.getUTCDate() + days);

    return isoDay(date);
}

/** ISO weekday 1 (Monday) … 7 (Sunday). */
export function isoWeekday(day: string): number {
    const weekday = utcDay(day).getUTCDay();

    return weekday === 0 ? 7 : weekday;
}

/**
 * Weeks (Monday first) covering the month `"YYYY-MM"`: from the Monday on
 * or before the 1st to the Sunday on or after the last day.
 */
export function monthGrid(month: string): string[][] {
    const first = `${month}-01`;
    const start = addDays(first, 1 - isoWeekday(first));
    const last = addDays(shiftMonth(month, 1) + '-01', -1);
    const end = addDays(last, 7 - isoWeekday(last));
    const weeks: string[][] = [];

    for (let day = start; day <= end; day = addDays(day, 7)) {
        weeks.push(
            Array.from({ length: 7 }, (_, index) => addDays(day, index)),
        );
    }

    return weeks;
}

/** The seven days (Monday first) of the week holding `day`. */
export function weekOf(day: string): string[] {
    const monday = addDays(day, 1 - isoWeekday(day));

    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** "2026-10" ± n months → "2026-11". */
export function shiftMonth(month: string, delta: number): string {
    const [year, number] = month.split('-').map(Number);
    const index = year * 12 + (number - 1) + delta;

    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export const MONTHS = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
] as const;

export const WEEKDAYS_SHORT = [
    'Sen',
    'Sel',
    'Rab',
    'Kam',
    'Jum',
    'Sab',
    'Min',
] as const;

/** "2026-10" → "Oktober 2026". */
export function monthLabel(month: string): string {
    const [year, number] = month.split('-').map(Number);

    return `${MONTHS[number - 1] ?? ''} ${year}`;
}

/** "2026-10-20" → "Sel 20". */
export function shortDay(day: string): string {
    return `${WEEKDAYS_SHORT[isoWeekday(day) - 1]} ${Number(day.slice(8, 10))}`;
}

/** "2026-10-16" → "Jum, 16 Okt" (no year; zone-free). */
export function dueLabel(day: string): string {
    const month = MONTHS[Number(day.slice(5, 7)) - 1]?.slice(0, 3) ?? '';

    return `${WEEKDAYS_SHORT[isoWeekday(day) - 1]}, ${Number(day.slice(8, 10))} ${month}`;
}

/** 45 → "45 menit", 130 → "2 jam 10 menit", 120 → "2 jam". */
export function durationLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) {
        return `${rest} menit`;
    }

    return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

/** "menunggu 26 jam" / "menunggu 3 hari" / "baru masuk". */
export function waitingLabel(
    since: string | null,
    now: Date = new Date(),
): string | null {
    if (since === null) {
        return null;
    }

    const minutes = Math.floor(
        (now.getTime() - new Date(since).getTime()) / 60_000,
    );

    if (!Number.isFinite(minutes)) {
        return null;
    }

    if (minutes < 60) {
        return 'baru masuk';
    }

    const hours = Math.floor(minutes / 60);

    return hours < 48
        ? `menunggu ${hours} jam`
        : `menunggu ${Math.floor(hours / 24)} hari`;
}

/* ---------------------------------------------------------- calendar */

export const EVENT_KINDS: Record<
    EventKind,
    { label: string; legend: string; chip: string; bar: string }
> = {
    meeting: {
        label: 'Rapat',
        legend: 'Rapat',
        chip: 'bg-link-soft text-link',
        bar: 'bg-fill-teal',
    },
    interview: {
        label: 'Wawancara',
        legend: 'Wawancara',
        chip: 'bg-tag-violet/12 text-tag-violet',
        bar: 'bg-fill-violet',
    },
    leave: {
        label: 'Cuti',
        legend: 'Cuti & izin pegawai',
        chip: 'bg-info-soft text-info',
        bar: 'bg-accent-blue',
    },
    holiday: {
        label: 'Libur',
        legend: 'Hari libur',
        chip: 'bg-surface-2 text-text-muted',
        bar: 'bg-border-strong',
    },
};

export const EVENT_KIND_ORDER: readonly EventKind[] = [
    'meeting',
    'interview',
    'leave',
    'holiday',
];

/* ------------------------------------------------------- assignments */

export const ASSIGNMENT_STATUSES: Record<
    AssignmentStatus,
    { label: string; tone: BadgeTone }
> = {
    not_started: { label: 'Belum mulai', tone: 'neutral' },
    in_progress: { label: 'Dikerjakan', tone: 'link' },
    overdue: { label: 'Terlambat', tone: 'danger' },
    done: { label: 'Selesai', tone: 'success' },
};

export type StatusFilter = AssignmentStatus | 'all';

/** Chips of the Penugasan tab, in the mockup order. */
export function statusChips(
    counts: Record<StatusFilter, number>,
): { value: StatusFilter; label: string; count: number }[] {
    return (
        ['all', 'not_started', 'in_progress', 'overdue', 'done'] as const
    ).map((value) => ({
        value,
        label: value === 'all' ? 'Semua' : ASSIGNMENT_STATUSES[value].label,
        count: counts[value] ?? 0,
    }));
}

/** "Terlambat 4 hari", "Dikerjakan", … */
export function assignmentStatusText(row: AssignmentRow): string {
    return row.status === 'overdue' && row.overdue_days > 0
        ? `Terlambat ${row.overdue_days} hari`
        : row.status_label;
}

/** "Bayu Saputra" · "Bayu Saputra +2" · "7 pegawai". */
export function assigneeText(row: AssignmentRow): string {
    if (row.assignee_count === 0) {
        return 'Belum ada penanggung jawab';
    }

    if (row.assignee_count === 1) {
        return row.assignees[0]?.name ?? '1 pegawai';
    }

    if (row.assignee_count <= 2) {
        return row.assignees.map((person) => person.name).join(', ');
    }

    return `${row.assignee_count} pegawai`;
}

/** 0–100 checklist progress (done tasks = 100). */
export function assignmentProgress(row: AssignmentRow): number {
    if (row.status === 'done') {
        return 100;
    }

    return row.checklist.total > 0
        ? Math.round((row.checklist.done / row.checklist.total) * 100)
        : 0;
}

/** Priority 0–4 as stored (tasks.priority): 0 tanpa · 1 urgent … 4 rendah. */
export const PRIORITY_OPTIONS = [
    { value: '0', label: 'Tanpa prioritas' },
    { value: '1', label: 'Urgent' },
    { value: '2', label: 'Tinggi' },
    { value: '3', label: 'Sedang' },
    { value: '4', label: 'Rendah' },
] as const;

/* -------------------------------------------------------- recipients */

export type Recipient = {
    type: 'user' | 'division' | 'team';
    id: string;
};

export type RecipientOption = Recipient & {
    label: string;
    meta: string;
    people: number;
    /** Division name of a person/team (overlap with chosen divisions). */
    division: string | null;
};

/** Every pickable person, division and team as one searchable list. */
export function recipientOptions(
    pickers: AssignmentPickers,
): RecipientOption[] {
    return [
        ...pickers.divisions.map((division) => ({
            type: 'division' as const,
            id: division.id,
            label: `Divisi ${division.name}`,
            meta: `${division.people} orang`,
            people: division.people,
            division: division.name,
        })),
        ...pickers.teams.map((team) => ({
            type: 'team' as const,
            id: team.id,
            label: `Tim ${team.name}`,
            meta: [team.division, `${team.people} orang`]
                .filter(Boolean)
                .join(' · '),
            people: team.people,
            division: team.division,
        })),
        ...pickers.people.map((person) => ({
            type: 'user' as const,
            id: person.id,
            label: person.name,
            meta: person.division ?? 'Tanpa divisi',
            people: 1,
            division: person.division,
        })),
    ];
}

/** Case-insensitive match on the label and meta, max `limit` rows. */
export function searchRecipients(
    options: RecipientOption[],
    query: string,
    chosen: Recipient[],
    limit = 8,
): RecipientOption[] {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    const taken = new Set(chosen.map((item) => `${item.type}:${item.id}`));

    return options
        .filter((option) => !taken.has(`${option.type}:${option.id}`))
        .filter(
            (option) =>
                needle === '' ||
                option.label.toLocaleLowerCase('id-ID').includes(needle) ||
                option.meta.toLocaleLowerCase('id-ID').includes(needle),
        )
        .slice(0, limit);
}

/**
 * How many people the chosen recipients reach. Divisions are counted with
 * their direct members; a team or person inside a chosen division is not
 * counted twice. People inside a chosen team cannot be matched (the pickers
 * do not list team members), nor can sub-divisions (the server adds them),
 * so the count is `approximate` then.
 */
export function recipientCount(
    chosen: Recipient[],
    options: RecipientOption[],
): { count: number; approximate: boolean } {
    const byKey = new Map(
        options.map((option) => [`${option.type}:${option.id}`, option]),
    );
    const picked = chosen
        .map((item) => byKey.get(`${item.type}:${item.id}`))
        .filter((option): option is RecipientOption => option !== undefined);
    const divisions = new Set(
        picked
            .filter((option) => option.type === 'division')
            .map((option) => option.division),
    );
    const outside = (option: RecipientOption) =>
        !(option.division !== null && divisions.has(option.division));
    const teams = picked.filter(
        (option) => option.type === 'team' && outside(option),
    );
    let count = 0;

    for (const option of picked) {
        const inDivision =
            option.type !== 'division' &&
            option.division !== null &&
            divisions.has(option.division);

        if (!inDivision) {
            count += option.people;
        }
    }

    const users = picked.filter(
        (option) => option.type === 'user' && outside(option),
    );

    return { count, approximate: teams.length > 0 && users.length > 0 };
}

/** Request body keys of POST /hr/penugasan. */
export function recipientPayload(chosen: Recipient[]): {
    user_ids: string[];
    division_ids: string[];
    team_ids: string[];
} {
    const of = (type: Recipient['type']) =>
        chosen.filter((item) => item.type === type).map((item) => item.id);

    return {
        user_ids: of('user'),
        division_ids: of('division'),
        team_ids: of('team'),
    };
}

/* ----------------------------------------------------------- actions */

export const ACTION_KINDS: Record<
    ActionKind,
    { label: string; tone: BadgeTone; cta: string }
> = {
    request: { label: 'Pengajuan', tone: 'info', cta: 'Putuskan' },
    password_reset: { label: 'Sandi', tone: 'neutral', cta: 'Buka' },
    correction: { label: 'Koreksi', tone: 'warning', cta: 'Atur' },
    hiring: { label: 'Hiring', tone: 'link', cta: 'Buka' },
};
