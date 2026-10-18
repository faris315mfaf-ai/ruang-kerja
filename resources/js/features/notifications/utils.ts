import { formatDate, officeDateFormat } from '@/lib/format';
import type {
    BroadcastedNotification,
    InboxFilters,
    InboxNotification,
} from '@/types/notifications';

const calendarDay = (): Intl.DateTimeFormat =>
    officeDateFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

function dayIndex(date: Date): number {
    const [year, month, day] = calendarDay()
        .format(date)
        .split('-')
        .map(Number);

    return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** "Hari ini" · "Kemarin" · "Sab, 3 Okt 2026" (office timezone). */
export function dayGroupLabel(
    value: string | null,
    now: Date = new Date(),
): string {
    if (!value) {
        return 'Lainnya';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Lainnya';
    }

    const diff = dayIndex(now) - dayIndex(date);

    if (diff === 0) {
        return 'Hari ini';
    }

    if (diff === 1) {
        return 'Kemarin';
    }

    return formatDate(date);
}

export type DayGroup<T> = { label: string; items: T[] };

/** Groups items (already sorted newest first) by office-local day. */
export function groupByDay<T extends { created_at: string | null }>(
    items: T[],
    now: Date = new Date(),
): DayGroup<T>[] {
    const groups: DayGroup<T>[] = [];

    for (const item of items) {
        const label = dayGroupLabel(item.created_at, now);
        const last = groups.at(-1);

        if (last && last.label === label) {
            last.items.push(item);
        } else {
            groups.push({ label, items: [item] });
        }
    }

    return groups;
}

export type TitleSegment = { text: string; strong: boolean };

/**
 * Splits a title so the actor's name and the subject code render bold
 * ("**Sari Wulandari** menyebut Anda di **PLQ-15**"). Case-sensitive, first
 * occurrence of each highlight, non-overlapping.
 */
export function titleSegments(
    title: string,
    highlights: (string | null | undefined)[],
): TitleSegment[] {
    const ranges: [number, number][] = [];

    for (const highlight of highlights) {
        if (!highlight) {
            continue;
        }

        const start = title.indexOf(highlight);

        if (start === -1) {
            continue;
        }

        const end = start + highlight.length;

        if (ranges.some(([s, e]) => start < e && end > s)) {
            continue;
        }

        ranges.push([start, end]);
    }

    ranges.sort((a, b) => a[0] - b[0]);

    const segments: TitleSegment[] = [];
    let cursor = 0;

    for (const [start, end] of ranges) {
        if (start > cursor) {
            segments.push({ text: title.slice(cursor, start), strong: false });
        }

        segments.push({ text: title.slice(start, end), strong: true });
        cursor = end;
    }

    if (cursor < title.length) {
        segments.push({ text: title.slice(cursor), strong: false });
    }

    return segments;
}

/** Realtime payload → Inbox item (unread, not archived). */
export function fromBroadcast(
    payload: BroadcastedNotification,
): InboxNotification {
    return {
        id: payload.id,
        type: payload.type,
        category: payload.category,
        icon: payload.icon,
        tone: payload.tone,
        type_label: '',
        title: payload.title,
        body: payload.body,
        url: payload.url,
        actor: payload.actor,
        subject: payload.subject,
        // PHP encodes an empty meta array as [].
        meta: Array.isArray(payload.meta) ? {} : payload.meta,
        action_required: payload.action_required,
        read_at: null,
        archived_at: null,
        created_at: payload.created_at,
    };
}

/** Whether a fresh (unread, active) notification belongs in the current list. */
export function matchesFilters(
    notification: InboxNotification,
    filters: InboxFilters,
): boolean {
    if (filters.archived) {
        return false;
    }

    if (filters.tab === 'action' && !notification.action_required) {
        return false;
    }

    if (filters.kind === 'mention') {
        return notification.type === 'mention';
    }

    return filters.kind === null || filters.kind === notification.category;
}
