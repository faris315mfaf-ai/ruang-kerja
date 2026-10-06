import type { BadgeTone } from '@/components/ui/badge';
import {
    diffDays,
    endOfWeek,
    formatDayMonth,
    formatDue,
} from '@/features/tasks/lib/due-date';
import type { IncomingItem, Lane, Planner, PlannerItem } from './types';

export const LANES: Lane[] = ['today', 'week', 'later'];

export const LANE_LABELS: Record<Lane, string> = {
    today: 'Hari ini',
    week: 'Minggu ini',
    later: 'Nanti',
};

export const RUANG_SAYA_SUBTITLE =
    'Rencana Anda sendiri. Status tugas tim tidak berubah sampai Anda menandai selesai.';

/** "Nanti" shows this many open cards before "+N lainnya". */
export const LATER_PREVIEW = 5;

/**
 * Lane of a task without a plan (mirrors App\Domain\Planner\Services\
 * LanePlacement): overdue or due today → today, by Sunday of this ISO week
 * → week, later or undated → later.
 */
export function autoLane(due: string | null, today: string): Lane {
    if (!due) {
        return 'later';
    }

    if (due <= today) {
        return 'today';
    }

    return due <= endOfWeek(today) ? 'week' : 'later';
}

/** Due pill: danger "Lewat 2 hari", warning "Hari ini"/"Besok", else the date. */
export function duePill(
    due: string | null,
    today: string,
): { text: string; tone: BadgeTone } | null {
    if (!due) {
        return null;
    }

    const days = diffDays(today, due);

    if (days < 0) {
        return { text: `Lewat ${-days} hari`, tone: 'danger' };
    }

    if (days <= 1) {
        return { text: days === 0 ? 'Hari ini' : 'Besok', tone: 'warning' };
    }

    return { text: formatDue(due, today), tone: 'neutral' };
}

/** "dari Dimas Pratama · tenggat 23 Okt" (incoming row meta). */
export function incomingMeta(item: IncomingItem, today: string): string {
    const parts: string[] = [];

    if (item.assigned_by) {
        parts.push(`dari ${item.assigned_by}`);
    }

    if (!item.due_date) {
        parts.push('tanpa tenggat');
    } else {
        const days = diffDays(today, item.due_date);
        parts.push(
            days < 0
                ? `lewat tenggat ${-days} hari`
                : days === 0
                  ? 'tenggat hari ini'
                  : days === 1
                    ? 'tenggat besok'
                    : `tenggat ${formatDayMonth(item.due_date)}`,
        );
    }

    return parts.join(' · ');
}

export function progressLabel(progress: Planner['progress']): string {
    return `${progress.done} dari ${progress.total} selesai hari ini`;
}

export function progressPercent(progress: Planner['progress']): number {
    return progress.total === 0 ? 0 : (progress.done / progress.total) * 100;
}

/** Open cards first (draggable), cards completed today last. */
export function splitLane(items: PlannerItem[]): {
    open: PlannerItem[];
    done: PlannerItem[];
} {
    return {
        open: items.filter((item) => !item.done),
        done: items.filter((item) => item.done),
    };
}

/**
 * Planned neighbours of a drop at `index` among the lane's open cards (the
 * moving card already removed). Automatic cards have no position, so the
 * server only understands planned neighbours: the nearest planned card above
 * wins, else the nearest planned card below, else "end of the planned part".
 */
export function plannedNeighbours(
    open: PlannerItem[],
    index: number,
): { after_id: string | null; before_id: string | null } {
    const above = open
        .slice(0, index)
        .filter((item) => !item.auto)
        .at(-1);

    if (above) {
        return { after_id: above.id, before_id: null };
    }

    const below = open.slice(index).find((item) => !item.auto);

    return { after_id: null, before_id: below?.id ?? null };
}

/* ------------------------------------------------------------- reducer */

export type PlannerAction =
    | { type: 'replace'; planner: Planner }
    | { type: 'plan'; id: string; lane: Lane; index?: number }
    | { type: 'unplan'; id: string }
    | { type: 'complete'; id: string; outcome: 'review' | 'done'; now: string }
    | { type: 'add'; item: PlannerItem };

function findItem(
    planner: Planner,
    id: string,
): { item: PlannerItem; lane: Lane } | null {
    for (const lane of LANES) {
        const item = planner.lanes[lane].find((entry) => entry.id === id);

        if (item) {
            return { item, lane };
        }
    }

    return null;
}

/** An accepted incoming task, until the server answers with the real row. */
export function fromIncoming(item: IncomingItem, lane: Lane): PlannerItem {
    return {
        id: item.id,
        key: item.key,
        number: item.number,
        title: item.title,
        url: item.url,
        workspace: item.workspace,
        due_date: item.due_date,
        days_late: item.days_late,
        priority: item.priority,
        status: { id: '', name: 'Todo', category: 'todo' },
        is_personal: false,
        checklist: null,
        lane,
        auto: false,
        carried: false,
        done: false,
        completed_at: null,
        can_complete: false,
        completes_to: null,
        complete_hint: null,
        pending: true,
    };
}

function without(planner: Planner, id: string): Planner['lanes'] {
    return {
        today: planner.lanes.today.filter((item) => item.id !== id),
        week: planner.lanes.week.filter((item) => item.id !== id),
        later: planner.lanes.later.filter((item) => item.id !== id),
    };
}

/** Inserts among the open cards (planned part by default), done cards stay last. */
function insert(
    items: PlannerItem[],
    item: PlannerItem,
    index?: number,
): PlannerItem[] {
    const { open, done } = splitLane(items);
    const plannedEnd = open.filter((entry) => !entry.auto).length;
    let at = index ?? plannedEnd;

    if (item.auto) {
        // Automatic: sorted by due date after the planned cards (undated last).
        const due = item.due_date ?? '9999-12-31';
        const next = open.findIndex(
            (entry, position) =>
                position >= plannedEnd &&
                (entry.due_date ?? '9999-12-31') > due,
        );
        at = next === -1 ? open.length : next;
    }

    at = Math.max(0, Math.min(at, open.length));

    return item.done
        ? [...open, ...done, item]
        : [...open.slice(0, at), item, ...open.slice(at), ...done];
}

/** Lane counts and today's progress from the lanes themselves. */
export function recount(planner: Planner): Planner {
    const counts = { ...planner.counts, incoming: planner.incoming.length };

    for (const lane of LANES) {
        counts[lane] = planner.lanes[lane].filter((item) => !item.done).length;
    }

    const doneToday = planner.lanes.today.filter((item) => item.done).length;

    return {
        ...planner,
        counts,
        progress: { done: doneToday, total: doneToday + counts.today },
    };
}

/**
 * Optimistic changes of Ruang saya; the server's answer replaces the whole
 * planner afterwards (`replace`), so these only need to look right.
 */
export function plannerReducer(
    planner: Planner,
    action: PlannerAction,
): Planner {
    switch (action.type) {
        case 'replace':
            return action.planner;

        case 'plan': {
            const incoming = planner.incoming.find(
                (item) => item.id === action.id,
            );
            const found = findItem(planner, action.id);
            const source = incoming
                ? fromIncoming(incoming, action.lane)
                : found?.item;

            if (!source) {
                return planner;
            }

            const item: PlannerItem = {
                ...source,
                lane: action.lane,
                auto: false,
                carried: found?.lane === action.lane && source.carried,
            };
            const lanes = without(planner, action.id);
            lanes[action.lane] = insert(lanes[action.lane], item, action.index);

            return recount({
                ...planner,
                incoming: planner.incoming.filter(
                    (entry) => entry.id !== action.id,
                ),
                lanes,
            });
        }

        case 'unplan': {
            const found = findItem(planner, action.id);

            if (!found) {
                return planner;
            }

            const lane = autoLane(found.item.due_date, planner.today);
            const item = { ...found.item, lane, auto: true, carried: false };
            const lanes = without(planner, action.id);
            lanes[lane] = insert(lanes[lane], item);

            return recount({ ...planner, lanes });
        }

        case 'complete': {
            const found = findItem(planner, action.id);

            if (!found) {
                return planner;
            }

            const item: PlannerItem =
                action.outcome === 'review'
                    ? {
                          ...found.item,
                          status: {
                              ...found.item.status,
                              name: 'Review',
                              category: 'review',
                          },
                          completes_to: 'done',
                          pending: true,
                      }
                    : {
                          ...found.item,
                          status: {
                              ...found.item.status,
                              name: 'Selesai',
                              category: 'done',
                          },
                          done: true,
                          carried: false,
                          completed_at: action.now,
                          can_complete: false,
                          completes_to: null,
                          pending: true,
                      };
            const lanes = without(planner, action.id);
            lanes[found.lane] =
                action.outcome === 'review'
                    ? planner.lanes[found.lane].map((entry) =>
                          entry.id === action.id ? item : entry,
                      )
                    : insert(lanes[found.lane], item);

            return recount({ ...planner, lanes });
        }

        case 'add': {
            const lanes = { ...planner.lanes };
            lanes[action.item.lane] = insert(
                lanes[action.item.lane],
                action.item,
            );

            return recount({ ...planner, lanes });
        }
    }
}
