import { formatTime, OFFICE_TIMEZONE } from '@/lib/format';
import type {
    ActionItem,
    ApprovedLeave,
    BusyBlock,
    CalendarEntry,
    CalendarLayer,
    Holiday,
    Meeting,
    Minutes,
    Person,
    PersonId,
    Platform,
    Recurrence,
    Rsvp,
    TaskDue,
} from './types';

const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Office dates ("YYYY-MM-DD" in Asia/Jakarta)
// ---------------------------------------------------------------------------

const isoDay = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: OFFICE_TIMEZONE,
});

/** Office calendar date of an instant. */
export function officeDate(iso: string | number | Date): string {
    return isoDay.format(new Date(iso));
}

function dateToUtc(date: string): Date {
    const [y, m, d] = date.split('-').map(Number);

    return new Date(Date.UTC(y, m - 1, d));
}

function utcToDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
    const value = dateToUtc(date);
    value.setUTCDate(value.getUTCDate() + days);

    return utcToDate(value);
}

/** 1 = Monday … 7 = Sunday (shift_assignments.weekdays convention). */
export function isoWeekday(date: string): number {
    const day = dateToUtc(date).getUTCDay();

    return day === 0 ? 7 : day;
}

export function startOfWeek(date: string): string {
    return addDays(date, 1 - isoWeekday(date));
}

/** Monday-first dates of the week of `date` (5 = work week, 7 = full). */
export function weekDates(date: string, count: 5 | 7 = 5): string[] {
    const monday = startOfWeek(date);

    return Array.from({ length: count }, (_, i) => addDays(monday, i));
}

/** ISO-8601 week number ("Minggu 41"). */
export function isoWeekNumber(date: string): number {
    const thursday = addDays(date, 4 - isoWeekday(date));
    const year = Number(thursday.slice(0, 4));
    const firstThursday = dateToUtc(
        addDays(`${year}-01-04`, 4 - isoWeekday(`${year}-01-04`)),
    );

    return (
        Math.round(
            (dateToUtc(thursday).getTime() - firstThursday.getTime()) /
                (7 * 24 * 60 * MINUTE),
        ) + 1
    );
}

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DOW_LONG = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu',
];
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
const MONTHS_LONG = [
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
];

/** "Sen". */
export function dayShort(date: string): string {
    return DOW[isoWeekday(date) - 1];
}

/** "Senin". */
export function dayLong(date: string): string {
    return DOW_LONG[isoWeekday(date) - 1];
}

/** "5". */
export function dayNumber(date: string): string {
    return String(Number(date.slice(8, 10)));
}

/** "Sen, 5 Okt". */
export function shortDate(date: string): string {
    return `${dayShort(date)}, ${dayNumber(date)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** "Senin, 5 Oktober". */
export function longDate(date: string): string {
    return `${dayLong(date)}, ${dayNumber(date)} ${MONTHS_LONG[Number(date.slice(5, 7)) - 1]}`;
}

/** "Oktober 2026". */
export function monthTitle(year: number, month: number): string {
    return `${MONTHS_LONG[month - 1]} ${year}`;
}

/** "5–9 Oktober 2026" for a run of dates in one month (else with months). */
export function rangeTitle(dates: string[]): string {
    const first = dates[0];
    const last = dates[dates.length - 1];
    const year = last.slice(0, 4);

    if (first.slice(0, 7) === last.slice(0, 7)) {
        return `${dayNumber(first)}–${dayNumber(last)} ${MONTHS_LONG[Number(last.slice(5, 7)) - 1]} ${year}`;
    }

    return `${dayNumber(first)} ${MONTHS[Number(first.slice(5, 7)) - 1]} – ${dayNumber(last)} ${MONTHS[Number(last.slice(5, 7)) - 1]} ${year}`;
}

/**
 * Monday-first weeks covering a month (each week = 7 dates, leading and
 * trailing days from neighbour months included).
 */
export function monthGrid(year: number, month: number): string[][] {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth =
        month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = addDays(nextMonth, -1);
    const weeks: string[][] = [];

    for (
        let cursor = startOfWeek(first);
        cursor <= lastDay;
        cursor = addDays(cursor, 7)
    ) {
        weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    }

    return weeks;
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

/** "10.30–11.30". */
export function timeRange(startsAt: string, endsAt?: string | null): string {
    return endsAt
        ? `${formatTime(startsAt)}–${formatTime(endsAt)}`
        : formatTime(startsAt);
}

/** "HH:MM" → minutes after midnight, or null when malformed. */
export function parseClock(value: string): number | null {
    const match = /^(\d{1,2})[:.](\d{2})$/.exec(value.trim());

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** ISO instant (+07:00) for an office date and "HH:MM". */
export function officeInstant(date: string, clock: string): string {
    return `${date}T${clock.replace('.', ':')}:00+07:00`;
}

/** Minutes after midnight (office time) of an instant. */
export function clockMinutes(iso: string): number {
    const [hours, minutes] = formatTime(iso).split('.').map(Number);

    return hours * 60 + minutes;
}

export function durationMinutes(startsAt: string, endsAt: string): number {
    return Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / MINUTE);
}

/** "30 menit", "1 jam", "1 jam 30 menit". */
export function durationLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) {
        return `${rest} menit`;
    }

    return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

// ---------------------------------------------------------------------------
// People & meetings
// ---------------------------------------------------------------------------

export function personById(
    people: Person[],
    id: PersonId | null,
): Person | null {
    return id ? (people.find((person) => person.id === id) ?? null) : null;
}

export function firstName(name: string): string {
    return name.split(' ')[0];
}

export function isParticipant(meeting: Meeting, id: PersonId): boolean {
    return meeting.participants.some(
        (participant) => participant.user_id === id,
    );
}

export function sortByStart(meetings: Meeting[]): Meeting[] {
    return [...meetings].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function meetingsOn(meetings: Meeting[], date: string): Meeting[] {
    return sortByStart(
        meetings.filter((meeting) => officeDate(meeting.starts_at) === date),
    );
}

export type Phase = 'done' | 'live' | 'soon' | 'upcoming';

/** Minutes before start when a meeting counts as "soon" (chip, toast). */
export const SOON_MINUTES = 15;

export function meetingPhase(meeting: Meeting, now: number): Phase {
    const start = Date.parse(meeting.starts_at);
    const end = Date.parse(meeting.ends_at);

    if (now >= end) {
        return 'done';
    }

    if (now >= start) {
        return 'live';
    }

    return start - now <= SOON_MINUTES * MINUTE ? 'soon' : 'upcoming';
}

/** "Mulai 5 menit lagi", "Sedang berlangsung · 12 menit", "Selesai". */
export function phaseLabel(meeting: Meeting, now: number): string {
    const phase = meetingPhase(meeting, now);

    if (phase === 'done') {
        return 'Selesai';
    }

    if (phase === 'live') {
        const elapsed = Math.floor(
            (now - Date.parse(meeting.starts_at)) / MINUTE,
        );

        return elapsed < 1
            ? 'Baru saja dimulai'
            : `Sedang berlangsung · ${elapsed} menit`;
    }

    const left = Math.ceil((Date.parse(meeting.starts_at) - now) / MINUTE);

    if (phase === 'soon') {
        return left <= 1 ? 'Mulai sebentar lagi' : `Mulai ${left} menit lagi`;
    }

    const sameDay = officeDate(meeting.starts_at) === officeDate(now);

    if (sameDay && left < 180) {
        const hours = Math.floor(left / 60);
        const minutes = left % 60;

        return hours === 0
            ? `Mulai ${minutes} menit lagi`
            : `Mulai ${hours} jam ${minutes} menit lagi`;
    }

    return sameDay
        ? `Mulai ${formatTime(meeting.starts_at)}`
        : `${shortDate(officeDate(meeting.starts_at))} · ${formatTime(meeting.starts_at)}`;
}

/** The meeting to put in the hero today: live first, else the next one. */
export function nextMeeting(meetings: Meeting[], now: number): Meeting | null {
    const today = meetingsOn(meetings, officeDate(now));

    return (
        today.find((meeting) => meetingPhase(meeting, now) === 'live') ??
        today.find((meeting) => meetingPhase(meeting, now) !== 'done') ??
        null
    );
}

export function rsvpCounts(meeting: Meeting): Record<Rsvp, number> {
    const counts: Record<Rsvp, number> = {
        accepted: 0,
        tentative: 0,
        declined: 0,
        pending: 0,
    };

    for (const participant of meeting.participants) {
        counts[participant.rsvp] += 1;
    }

    return counts;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
    meet: 'Google Meet',
    zoom: 'Zoom',
    room: 'Tatap muka',
    client: 'Di klien',
};

export const RSVP_LABEL: Record<Rsvp, string> = {
    accepted: 'Hadir',
    tentative: 'Mungkin',
    declined: 'Tidak hadir',
    pending: 'Belum menjawab',
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
    none: 'Tidak berulang',
    weekdays: 'Setiap hari kerja',
    weekly: 'Setiap minggu',
    mon_wed_fri: 'Senin, Rabu, Jumat',
};

/** Link a participant opens to join (Meet from Calendar, Zoom pasted). */
export function joinLink(meeting: Meeting): string | null {
    return meeting.calendar_event?.meet_link ?? meeting.join_url ?? null;
}

/** "meet.google.com/abc-defg-hij" without the scheme. */
export function displayLink(url: string): string {
    return url.replace(/^https?:\/\//, '');
}

// ---------------------------------------------------------------------------
// Scheduling: conflicts & free slot
// ---------------------------------------------------------------------------

export type Conflict = {
    user_id: PersonId;
    title: string;
    starts_at: string;
    ends_at: string;
};

function overlaps(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
): boolean {
    return aStart < bEnd && bStart < aEnd;
}

/**
 * Who is already busy between `startsAt` and `endsAt`: RuangKerja meetings
 * they did not decline plus busy blocks from their Google Calendar.
 */
export function findConflicts(
    participantIds: PersonId[],
    startsAt: string,
    endsAt: string,
    meetings: Meeting[],
    busy: BusyBlock[],
    ignoreMeetingId?: string,
): Conflict[] {
    const start = Date.parse(startsAt);
    const end = Date.parse(endsAt);
    const result: Conflict[] = [];

    for (const id of participantIds) {
        for (const meeting of meetings) {
            if (meeting.id === ignoreMeetingId) {
                continue;
            }

            const seat = meeting.participants.find((p) => p.user_id === id);

            if (
                seat &&
                seat.rsvp !== 'declined' &&
                overlaps(
                    start,
                    end,
                    Date.parse(meeting.starts_at),
                    Date.parse(meeting.ends_at),
                )
            ) {
                result.push({
                    user_id: id,
                    title: meeting.title,
                    starts_at: meeting.starts_at,
                    ends_at: meeting.ends_at,
                });
            }
        }

        for (const block of busy) {
            if (
                block.user_id === id &&
                overlaps(
                    start,
                    end,
                    Date.parse(block.starts_at),
                    Date.parse(block.ends_at),
                )
            ) {
                result.push({
                    user_id: id,
                    title: block.title,
                    starts_at: block.starts_at,
                    ends_at: block.ends_at,
                });
            }
        }
    }

    return result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/**
 * Earliest start (30-minute steps, from the requested time until the day
 * ends at 17.00) at which every participant is free; null when none.
 */
export function suggestFreeSlot(
    participantIds: PersonId[],
    date: string,
    startClock: string,
    duration: number,
    meetings: Meeting[],
    busy: BusyBlock[],
    ignoreMeetingId?: string,
): string | null {
    const from = parseClock(startClock);

    if (from === null) {
        return null;
    }

    const step = 30;
    const first = Math.ceil(from / step) * step;

    for (let minutes = first; minutes + duration <= 17 * 60; minutes += step) {
        const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        const startsAt = officeInstant(date, clock);
        const endsAt = new Date(
            Date.parse(startsAt) + duration * MINUTE,
        ).toISOString();

        if (
            findConflicts(
                participantIds,
                startsAt,
                endsAt,
                meetings,
                busy,
                ignoreMeetingId,
            ).length === 0
        ) {
            return clock;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Scheduling form validation
// ---------------------------------------------------------------------------

export type MeetingFormValues = {
    title: string;
    date: string;
    start: string;
    duration: number;
    platform: Exclude<Platform, 'client'>;
    zoomUrl: string;
    zoomPasscode: string;
    room: string;
    /** Person ids and guest emails, organizer first. */
    participants: string[];
    agenda: string[];
    recurrence: Recurrence;
    reminders: number[];
    minuteTakerId: PersonId;
    workspace: string;
};

export type MeetingFormErrors = Partial<
    Record<
        | 'title'
        | 'date'
        | 'start'
        | 'participants'
        | 'zoomUrl'
        | 'room'
        | 'agenda',
        string
    >
>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const ZOOM_URL =
    /^https:\/\/([a-z0-9-]+\.)?zoom\.us\/j\/\d{9,11}(\?pwd=[\w.-]+)?$/i;

export function isEmail(value: string): boolean {
    return EMAIL.test(value.trim());
}

export function isZoomUrl(value: string): boolean {
    return ZOOM_URL.test(value.trim());
}

/** Field errors in Indonesian, each naming the fix (docs/DESIGN.md §8). */
export function validateMeetingForm(
    values: MeetingFormValues,
    now: number,
    organizerId: PersonId,
): MeetingFormErrors {
    const errors: MeetingFormErrors = {};
    const title = values.title.trim();
    const today = officeDate(now);
    const start = parseClock(values.start);

    if (title.length === 0) {
        errors.title = 'Isi judul rapat.';
    } else if (title.length < 3) {
        errors.title = 'Judul minimal 3 karakter.';
    } else if (title.length > 120) {
        errors.title = 'Judul maksimal 120 karakter.';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
        errors.date = 'Pilih tanggal rapat.';
    } else if (values.date < today) {
        errors.date = 'Tanggal sudah lewat. Pilih hari ini atau sesudahnya.';
    }

    if (start === null) {
        errors.start = 'Isi jam mulai, misalnya 13.30.';
    } else if (start + values.duration > 24 * 60) {
        errors.start = 'Rapat harus selesai di hari yang sama.';
    } else if (
        !errors.date &&
        values.date === today &&
        Date.parse(officeInstant(values.date, values.start)) < now
    ) {
        errors.start = 'Jam mulai sudah lewat. Pilih jam yang akan datang.';
    }

    if (values.participants.filter((id) => id !== organizerId).length === 0) {
        errors.participants = 'Undang minimal satu peserta selain Anda.';
    }

    if (values.platform === 'zoom' && !isZoomUrl(values.zoomUrl)) {
        errors.zoomUrl =
            'Tempel tautan Zoom lengkap, misalnya https://zoom.us/j/81234567890.';
    }

    if (values.platform === 'room' && values.room.trim() === '') {
        errors.room = 'Pilih ruangan.';
    }

    if (values.agenda.every((item) => item.trim() === '')) {
        errors.agenda = 'Tambahkan minimal satu butir agenda.';
    }

    return errors;
}

// ---------------------------------------------------------------------------
// Minutes & follow-ups
// ---------------------------------------------------------------------------

export type ActionStatus = 'done' | 'late' | 'open';

export function actionStatus(item: ActionItem, today: string): ActionStatus {
    if (item.done) {
        return 'done';
    }

    return item.due_date < today ? 'late' : 'open';
}

export function minutesProgress(minutes: Pick<Minutes, 'action_items'>): {
    done: number;
    total: number;
    pct: number;
} {
    const total = minutes.action_items.length;
    const done = minutes.action_items.filter((item) => item.done).length;

    return {
        done,
        total,
        pct: total === 0 ? 0 : Math.round((done / total) * 100),
    };
}

export type OwnedAction = ActionItem & { meeting_id: string };

/** Open follow-ups of one person across minutes, most urgent first. */
export function openActionsFor(
    minutes: Minutes[],
    personId: PersonId,
): OwnedAction[] {
    return minutes
        .flatMap((record) =>
            record.action_items.map((item) => ({
                ...item,
                meeting_id: record.meeting_id,
            })),
        )
        .filter((item) => item.assignee_id === personId && !item.done)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** "Lewat 1 hari", "Hari ini", "Besok", "Rab, 7 Okt". */
export function dueLabel(due: string, today: string): string {
    if (due === today) {
        return 'Hari ini';
    }

    if (due === addDays(today, 1)) {
        return 'Besok';
    }

    if (due < today) {
        const days = Math.round(
            (dateToUtc(today).getTime() - dateToUtc(due).getTime()) /
                (24 * 60 * MINUTE),
        );

        return `Lewat ${days} hari`;
    }

    return shortDate(due);
}

/** Next task key for "Jadikan tugas": OPS-156, OPS-157 … */
export function nextTaskKey(prefix: string, number: number): string {
    return `${prefix}-${number}`;
}

/**
 * Turns follow-ups into tasks: each item without a key gets the next number
 * of the workspace sequence. Returns the items and the next free number.
 */
export function convertToTasks(
    items: ActionItem[],
    ids: string[],
    prefix: string,
    nextNumber: number,
): { items: ActionItem[]; nextNumber: number; created: string[] } {
    let number = nextNumber;
    const created: string[] = [];
    const result = items.map((item) => {
        if (!ids.includes(item.id) || item.task_key) {
            return item;
        }

        const key = nextTaskKey(prefix, number);
        number += 1;
        created.push(key);

        return { ...item, task_key: key };
    });

    return { items: result, nextNumber: number, created };
}

// ---------------------------------------------------------------------------
// Calendar layers
// ---------------------------------------------------------------------------

export const LAYER_LABEL: Record<CalendarLayer, string> = {
    meetings: 'Rapat',
    tasks: 'Tenggat tugas',
    leave: 'Cuti disetujui',
    holidays: 'Libur',
};

export const ALL_LAYERS: CalendarLayer[] = [
    'meetings',
    'tasks',
    'leave',
    'holidays',
];

export function buildCalendarEntries({
    meetings,
    tasks,
    leaves,
    holidays,
    people,
    personId,
    today,
}: {
    meetings: Meeting[];
    tasks: TaskDue[];
    leaves: ApprovedLeave[];
    holidays: Holiday[];
    people: Person[];
    personId: PersonId;
    today: string;
}): CalendarEntry[] {
    const entries: CalendarEntry[] = [];

    for (const meeting of meetings) {
        if (!isParticipant(meeting, personId)) {
            continue;
        }

        entries.push({
            id: `meeting-${meeting.id}`,
            layer: 'meetings',
            date: officeDate(meeting.starts_at),
            title: meeting.title,
            starts_at: meeting.starts_at,
            ends_at: meeting.ends_at,
            meta: `${timeRange(meeting.starts_at, meeting.ends_at)} · ${PLATFORM_LABEL[meeting.platform]}`,
            href: `/rapat/${meeting.id}`,
        });
    }

    for (const task of tasks) {
        if (task.done) {
            continue;
        }

        entries.push({
            id: `task-${task.key}`,
            layer: 'tasks',
            date: task.due_date,
            title: `${task.key} · ${task.title}`,
            meta: task.due_date < today ? 'Terlambat' : 'Tenggat',
            overdue: task.due_date < today,
        });
    }

    for (const leave of leaves) {
        const person = personById(people, leave.user_id);

        entries.push({
            id: `leave-${leave.id}`,
            layer: 'leave',
            date: leave.start_date,
            end_date: leave.end_date,
            title: `${person ? firstName(person.name) : 'Karyawan'} · ${leave.type}`,
            meta:
                leave.start_date === leave.end_date
                    ? shortDate(leave.start_date)
                    : `${shortDate(leave.start_date)} – ${shortDate(leave.end_date)}`,
        });
    }

    for (const holiday of holidays) {
        entries.push({
            id: `holiday-${holiday.date}`,
            layer: 'holidays',
            date: holiday.date,
            title: holiday.name,
            meta:
                holiday.type === 'national'
                    ? 'Libur nasional'
                    : holiday.type === 'collective_leave'
                      ? 'Cuti bersama'
                      : 'Libur kantor',
        });
    }

    return entries;
}

const LAYER_ORDER: Record<CalendarLayer, number> = {
    holidays: 0,
    leave: 1,
    tasks: 2,
    meetings: 3,
};

/** Entries visible on `date` for the enabled layers: all-day first, then by time. */
export function entriesOn(
    entries: CalendarEntry[],
    date: string,
    layers: CalendarLayer[],
): CalendarEntry[] {
    return entries
        .filter(
            (entry) =>
                layers.includes(entry.layer) &&
                entry.date <= date &&
                (entry.end_date ?? entry.date) >= date,
        )
        .sort((a, b) => {
            const byLayer = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];

            if (byLayer !== 0) {
                return byLayer;
            }

            return (a.starts_at ?? '').localeCompare(b.starts_at ?? '');
        });
}

/** Toggle one layer, never leaving the calendar with zero layers. */
export function toggleLayer(
    layers: CalendarLayer[],
    layer: CalendarLayer,
): CalendarLayer[] {
    if (layers.includes(layer)) {
        return layers.length === 1
            ? layers
            : layers.filter((item) => item !== layer);
    }

    return ALL_LAYERS.filter((item) => item === layer || layers.includes(item));
}

/**
 * Blocking problems before minutes can be finalised (each names the fix):
 * every follow-up needs text, an assignee and a due date.
 */
export function minutesProblems(
    minutes: Pick<Minutes, 'action_items' | 'attendance'>,
): string[] {
    const problems: string[] = [];

    if (!minutes.attendance.some((mark) => mark.present)) {
        problems.push('Tandai minimal satu peserta yang hadir.');
    }

    minutes.action_items.forEach((item, index) => {
        const label = `Tindak lanjut ${index + 1}`;

        if (item.text.trim() === '') {
            problems.push(`${label} belum diisi.`);
        }

        if (!item.assignee_id) {
            problems.push(`${label} belum punya penanggung jawab.`);
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.due_date)) {
            problems.push(`${label} belum punya tenggat.`);
        }
    });

    return problems;
}

/** Fresh draft for a meeting without minutes: agenda → empty sections. */
export function blankMinutes(meeting: Meeting, now: string): Minutes {
    return {
        meeting_id: meeting.id,
        status: 'draft',
        saved_at: now,
        version_count: 0,
        co_editor_id: null,
        attendance: meeting.participants
            .filter(
                (participant) =>
                    participant.user_id && participant.rsvp !== 'declined',
            )
            .map((participant) => ({
                user_id: participant.user_id as PersonId,
                present: true,
            })),
        sections: meeting.agenda.map((title) => ({ title, body: '' })),
        decisions: [],
        action_items: [],
        task_prefix: meeting.workspace?.key ?? 'RPT',
        next_task_number: 1,
    };
}
