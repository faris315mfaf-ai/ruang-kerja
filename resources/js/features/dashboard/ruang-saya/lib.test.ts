import { describe, expect, it } from 'vitest';
import {
    autoLane,
    duePill,
    fromIncoming,
    incomingMeta,
    plannedNeighbours,
    plannerReducer,
    progressLabel,
    progressPercent,
    recount,
} from './lib';
import type { IncomingItem, Planner, PlannerItem } from './types';

// Wednesday 7 Oct 2026; the ISO week ends Sunday 11 Oct.
const TODAY = '2026-10-07';

function item(id: string, overrides: Partial<PlannerItem> = {}): PlannerItem {
    return {
        id,
        key: `OPS-${id}`,
        number: 1,
        title: `Tugas ${id}`,
        url: `/w/OPS/tasks/${id}`,
        workspace: { name: 'Operasional', key: 'OPS', type: 'division' },
        due_date: null,
        days_late: 0,
        priority: 0,
        status: { id: 's1', name: 'Todo', category: 'todo' },
        is_personal: false,
        checklist: null,
        lane: 'today',
        auto: false,
        carried: false,
        done: false,
        completed_at: null,
        can_complete: true,
        completes_to: 'done',
        complete_hint: null,
        ...overrides,
    };
}

function incoming(
    id: string,
    overrides: Partial<IncomingItem> = {},
): IncomingItem {
    return {
        id,
        key: `OPS-${id}`,
        number: 9,
        title: `Baru ${id}`,
        url: `/w/OPS/tasks/${id}`,
        workspace: { name: 'Operasional', key: 'OPS', type: 'division' },
        due_date: '2026-10-23',
        days_late: 0,
        priority: 0,
        assigned_by: 'Dimas Pratama',
        assigned_at: '2026-10-07T02:00:00+00:00',
        ...overrides,
    };
}

function planner(
    lanes: Partial<Planner['lanes']>,
    extra: Partial<Planner> = {},
): Planner {
    return recount({
        today: TODAY,
        incoming: [],
        lanes: { today: [], week: [], later: [], ...lanes },
        counts: { today: 0, week: 0, later: 0, incoming: 0 },
        progress: { done: 0, total: 0 },
        ...extra,
    });
}

const ids = (items: PlannerItem[]) => items.map((entry) => entry.id);

describe('Ruang saya helpers', () => {
    it('places tasks without a plan like the server', () => {
        expect(autoLane('2026-10-01', TODAY)).toBe('today');
        expect(autoLane(TODAY, TODAY)).toBe('today');
        expect(autoLane('2026-10-08', TODAY)).toBe('week');
        expect(autoLane('2026-10-11', TODAY)).toBe('week');
        expect(autoLane('2026-10-12', TODAY)).toBe('later');
        expect(autoLane(null, TODAY)).toBe('later');
        // Sunday: next Monday is already "later".
        expect(autoLane('2026-10-12', '2026-10-11')).toBe('later');
    });

    it('labels due dates as pills', () => {
        expect(duePill('2026-10-05', TODAY)).toEqual({
            text: 'Lewat 2 hari',
            tone: 'danger',
        });
        expect(duePill(TODAY, TODAY)).toEqual({
            text: 'Hari ini',
            tone: 'warning',
        });
        expect(duePill('2026-10-08', TODAY)).toEqual({
            text: 'Besok',
            tone: 'warning',
        });
        expect(duePill('2026-10-23', TODAY)?.tone).toBe('neutral');
        expect(duePill('2026-10-23', TODAY)?.text).toContain('23 Okt');
        expect(duePill(null, TODAY)).toBeNull();
    });

    it('describes new assignments', () => {
        expect(incomingMeta(incoming('1'), TODAY)).toBe(
            'dari Dimas Pratama · tenggat 23 Okt',
        );
        expect(incomingMeta(incoming('1', { due_date: null }), TODAY)).toBe(
            'dari Dimas Pratama · tanpa tenggat',
        );
        expect(
            incomingMeta(
                incoming('1', { due_date: '2026-10-06', assigned_by: null }),
                TODAY,
            ),
        ).toBe('lewat tenggat 1 hari');
        expect(
            incomingMeta(incoming('1', { due_date: TODAY }), TODAY),
        ).toContain('tenggat hari ini');
        expect(
            incomingMeta(incoming('1', { due_date: '2026-10-08' }), TODAY),
        ).toContain('tenggat besok');
    });

    it('formats the progress of today', () => {
        expect(progressLabel({ done: 2, total: 5 })).toBe(
            '2 dari 5 selesai hari ini',
        );
        expect(progressPercent({ done: 2, total: 5 })).toBe(40);
        expect(progressPercent({ done: 0, total: 0 })).toBe(0);
    });

    it('only sends planned neighbours to the server', () => {
        const open = [
            item('a'),
            item('b'),
            item('c', { auto: true }),
            item('d', { auto: true }),
        ];

        expect(plannedNeighbours(open, 0)).toEqual({
            after_id: null,
            before_id: 'a',
        });
        expect(plannedNeighbours(open, 1)).toEqual({
            after_id: 'a',
            before_id: null,
        });
        expect(plannedNeighbours(open, 3)).toEqual({
            after_id: 'b',
            before_id: null,
        });
        expect(plannedNeighbours([item('x', { auto: true })], 0)).toEqual({
            after_id: null,
            before_id: null,
        });
    });
});

describe('plannerReducer', () => {
    it('accepts a new assignment into a lane', () => {
        const state = planner(
            { today: [item('a')] },
            { incoming: [incoming('n')] },
        );
        const next = plannerReducer(state, {
            type: 'plan',
            id: 'n',
            lane: 'today',
        });

        expect(next.incoming).toEqual([]);
        expect(ids(next.lanes.today)).toEqual(['a', 'n']);
        expect(next.lanes.today[1]).toMatchObject({
            lane: 'today',
            auto: false,
            pending: true,
            can_complete: false,
        });
        expect(next.counts).toEqual({
            today: 2,
            week: 0,
            later: 0,
            incoming: 0,
        });
    });

    it('moves and reorders planned cards before automatic ones, done cards stay last', () => {
        const state = planner({
            today: [
                item('a'),
                item('b'),
                item('late', { auto: true, due_date: '2026-10-01' }),
                item('done', { done: true }),
            ],
            week: [item('w', { lane: 'week' })],
        });

        const moved = plannerReducer(state, {
            type: 'plan',
            id: 'w',
            lane: 'today',
            index: 0,
        });
        expect(ids(moved.lanes.today)).toEqual(['w', 'a', 'b', 'late', 'done']);
        expect(moved.lanes.week).toEqual([]);

        // No index: end of the planned part.
        const appended = plannerReducer(state, {
            type: 'plan',
            id: 'w',
            lane: 'today',
        });
        expect(ids(appended.lanes.today)).toEqual([
            'a',
            'b',
            'w',
            'late',
            'done',
        ]);

        // An automatic card that gets planned leaves the automatic part.
        const planned = plannerReducer(state, {
            type: 'plan',
            id: 'late',
            lane: 'today',
            index: 0,
        });
        expect(planned.lanes.today[0]).toMatchObject({
            id: 'late',
            auto: false,
        });
    });

    it('keeps "terbawa" only when the card stays in today', () => {
        const state = planner({
            today: [item('a', { carried: true }), item('b')],
        });

        expect(
            plannerReducer(state, {
                type: 'plan',
                id: 'a',
                lane: 'today',
                index: 1,
            }).lanes.today[1],
        ).toMatchObject({ id: 'a', carried: true });
        expect(
            plannerReducer(state, { type: 'plan', id: 'a', lane: 'week' }).lanes
                .week[0],
        ).toMatchObject({ carried: false });
    });

    it('returns a card to its automatic lane by due date', () => {
        const state = planner({
            today: [item('a', { due_date: '2026-10-09' })],
            week: [
                item('x', { lane: 'week', auto: true, due_date: '2026-10-08' }),
                item('y', { lane: 'week', auto: true, due_date: '2026-10-10' }),
            ],
        });
        const next = plannerReducer(state, { type: 'unplan', id: 'a' });

        expect(next.lanes.today).toEqual([]);
        expect(ids(next.lanes.week)).toEqual(['x', 'a', 'y']);
        expect(next.lanes.week[1]).toMatchObject({ auto: true, lane: 'week' });
    });

    it('completes a card: done goes to the bottom and counts, review stays open', () => {
        const state = planner({
            today: [
                item('a'),
                item('b', { completes_to: 'review' }),
                item('c'),
            ],
        });
        const done = plannerReducer(state, {
            type: 'complete',
            id: 'a',
            outcome: 'done',
            now: '2026-10-07T03:00:00Z',
        });

        expect(ids(done.lanes.today)).toEqual(['b', 'c', 'a']);
        expect(done.lanes.today[2]).toMatchObject({
            done: true,
            can_complete: false,
            completed_at: '2026-10-07T03:00:00Z',
        });
        expect(done.progress).toEqual({ done: 1, total: 3 });
        expect(done.counts.today).toBe(2);

        const review = plannerReducer(done, {
            type: 'complete',
            id: 'b',
            outcome: 'review',
            now: '',
        });
        expect(ids(review.lanes.today)).toEqual(['b', 'c', 'a']);
        expect(review.lanes.today[0]).toMatchObject({
            done: false,
            completes_to: 'done',
        });
        expect(review.lanes.today[0].status.category).toBe('review');
        expect(review.progress).toEqual({ done: 1, total: 3 });
    });

    it('adds a quick note and rolls back with replace', () => {
        const state = planner({
            today: [item('a'), item('late', { auto: true })],
        });
        const added = plannerReducer(state, {
            type: 'add',
            item: item('temp-1', { is_personal: true, pending: true }),
        });

        expect(ids(added.lanes.today)).toEqual(['a', 'temp-1', 'late']);
        expect(plannerReducer(added, { type: 'replace', planner: state })).toBe(
            state,
        );
    });

    it('ignores unknown ids', () => {
        const state = planner({ today: [item('a')] });

        expect(
            plannerReducer(state, { type: 'plan', id: 'zz', lane: 'week' }),
        ).toBe(state);
        expect(plannerReducer(state, { type: 'unplan', id: 'zz' })).toBe(state);
        expect(
            plannerReducer(state, {
                type: 'complete',
                id: 'zz',
                outcome: 'done',
                now: '',
            }),
        ).toBe(state);
    });

    it('builds a placeholder from an incoming task', () => {
        expect(fromIncoming(incoming('n'), 'week')).toMatchObject({
            id: 'n',
            lane: 'week',
            is_personal: false,
            done: false,
            pending: true,
        });
    });
});
