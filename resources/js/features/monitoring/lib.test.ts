import { describe, expect, it } from 'vitest';
import {
    filterWorkspaces,
    moveNote,
    openIds,
    orderNotes,
    percentOf,
    shiftDate,
    toggleNote,
    variancePoints,
} from './lib';
import type { ActionNote, DirectoryWorkspace, MonitoredProject } from './types';

const note = (id: string, extra: Partial<ActionNote> = {}): ActionNote => ({
    id,
    body: `Catatan ${id}`,
    due_on: null,
    done: false,
    done_at: null,
    overdue: false,
    created_at: null,
    ...extra,
});

const workspace = (
    name: string,
    type: DirectoryWorkspace['type'],
    key: string,
): DirectoryWorkspace => ({
    id: key,
    key,
    name,
    type,
    type_label: type,
    color: 'teal',
    url: `/w/${key}`,
    members_count: 3,
    open_tasks_count: 2,
    view_only: true,
    health: null,
});

describe('shiftDate', () => {
    it('moves across months and years without timezone drift', () => {
        expect(shiftDate('2026-10-05', -1)).toBe('2026-10-04');
        expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
        expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    });
});

describe('percentOf', () => {
    it('rounds and never divides by zero', () => {
        expect(percentOf(2, 3)).toBe(67);
        expect(percentOf(0, 0)).toBe(0);
    });
});

describe('filterWorkspaces', () => {
    const list = [
        workspace('Peluncuran Produk X', 'project', 'PRJX'),
        workspace('Divisi Keuangan', 'division', 'KEU'),
        workspace('Tim Konten', 'team', 'KONTEN'),
    ];

    it('filters by type and by name or key, case-insensitive', () => {
        expect(filterWorkspaces(list, 'project', '').map((w) => w.key)).toEqual(
            ['PRJX'],
        );
        expect(filterWorkspaces(list, 'all', 'keu').map((w) => w.key)).toEqual([
            'KEU',
        ]);
        expect(
            filterWorkspaces(list, 'all', 'konten').map((w) => w.key),
        ).toEqual(['KONTEN']);
        expect(filterWorkspaces(list, 'team', 'keu')).toEqual([]);
        expect(filterWorkspaces(list, 'all', '  ')).toHaveLength(3);
    });
});

describe('variancePoints', () => {
    it('is actual minus planned, or null when unknown', () => {
        const project = {
            metrics: { actual: 40.4, planned: 55.6 },
        } as MonitoredProject;

        expect(variancePoints(project)).toBe(-15);
        expect(
            variancePoints({
                metrics: { actual: null, planned: 10 },
            } as MonitoredProject),
        ).toBeNull();
    });
});

describe('catatan tindakan', () => {
    it('orders open notes first and done ones latest first', () => {
        const ordered = orderNotes([
            note('a', { done: true, done_at: '2026-10-05T02:00:00Z' }),
            note('b'),
            note('c', { done: true, done_at: '2026-10-06T02:00:00Z' }),
            note('d'),
        ]);

        expect(ordered.map((n) => n.id)).toEqual(['b', 'd', 'c', 'a']);
    });

    it('toggles done and reopens a note at the end of the open list', () => {
        const list = [
            note('a'),
            note('b'),
            note('c', { done: true, done_at: '2026-10-05T02:00:00Z' }),
        ];
        const done = toggleNote(
            list,
            'a',
            true,
            '2026-10-06T03:00:00Z',
            '2026-10-06',
        );

        expect(done.map((n) => [n.id, n.done])).toEqual([
            ['b', false],
            ['a', true],
            ['c', true],
        ]);

        const reopened = toggleNote(
            done,
            'c',
            false,
            '2026-10-06T04:00:00Z',
            '2026-10-06',
        );

        expect(reopened.map((n) => n.id)).toEqual(['b', 'c', 'a']);
        expect(reopened[1].done_at).toBeNull();
    });

    it('marks a reopened note past its due date as overdue', () => {
        const list = [
            note('a', {
                done: true,
                due_on: '2026-10-01',
                done_at: '2026-10-02T00:00:00Z',
            }),
        ];

        expect(
            toggleNote(
                list,
                'a',
                false,
                '2026-10-06T00:00:00Z',
                '2026-10-06',
            )[0].overdue,
        ).toBe(true);
    });

    it('moves open notes up and down and leaves the edges alone', () => {
        const list = [
            note('a'),
            note('b'),
            note('c'),
            note('x', { done: true }),
        ];

        expect(openIds(moveNote(list, 'b', -1))).toEqual(['b', 'a', 'c']);
        expect(openIds(moveNote(list, 'b', 1))).toEqual(['a', 'c', 'b']);
        expect(moveNote(list, 'a', -1)).toBe(list);
        expect(moveNote(list, 'c', 1)).toBe(list);
        expect(moveNote(list, 'x', -1)).toBe(list);
        expect(moveNote(list, 'b', 1).at(-1)?.id).toBe('x');
    });
});
