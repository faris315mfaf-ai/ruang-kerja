import { describe, expect, it } from 'vite-plus/test';
import type {
    BroadcastedNotification,
    InboxNotification,
} from '@/types/notifications';
import {
    dayGroupLabel,
    fromBroadcast,
    groupByDay,
    matchesFilters,
    titleSegments,
} from './utils';

// Monday 5 Oct 2026, 09:00 WIB.
const NOW = new Date('2026-10-05T02:00:00Z');

function item(overrides: Partial<InboxNotification> = {}): InboxNotification {
    return {
        id: 'n1',
        type: 'mention',
        category: 'task',
        icon: 'at-sign',
        tone: 'primary',
        type_label: 'Disebut',
        title: 'Sari Wulandari menyebut Anda di PLQ-15',
        body: null,
        url: '/tugas',
        actor: { id: 'u1', name: 'Sari Wulandari', avatar: null },
        subject: {
            type: 'task',
            id: 't1',
            code: 'PLQ-15',
            title: 'Siaran pers',
        },
        meta: {},
        action_required: false,
        read_at: null,
        archived_at: null,
        created_at: '2026-10-05T01:00:00Z',
        ...overrides,
    };
}

describe('dayGroupLabel', () => {
    it('uses the office timezone for today and yesterday', () => {
        // 23:30 WIB on Sunday is "Kemarin" even though it is the same UTC day as NOW.
        expect(dayGroupLabel('2026-10-04T16:30:00Z', NOW)).toBe('Kemarin');
        // 00:30 WIB Monday = 17:30 UTC Sunday → "Hari ini".
        expect(dayGroupLabel('2026-10-04T17:30:00Z', NOW)).toBe('Hari ini');
        expect(dayGroupLabel('2026-10-03T03:00:00Z', NOW)).toBe(
            'Sab, 3 Okt 2026',
        );
    });

    it('handles missing or invalid dates', () => {
        expect(dayGroupLabel(null, NOW)).toBe('Lainnya');
        expect(dayGroupLabel('nope', NOW)).toBe('Lainnya');
    });
});

describe('groupByDay', () => {
    it('groups consecutive items by day label, keeping order', () => {
        const groups = groupByDay(
            [
                item({ id: 'a', created_at: '2026-10-05T01:00:00Z' }),
                item({ id: 'b', created_at: '2026-10-05T00:10:00Z' }),
                item({ id: 'c', created_at: '2026-10-04T08:00:00Z' }),
            ],
            NOW,
        );

        expect(
            groups.map((group) => [group.label, group.items.map((i) => i.id)]),
        ).toEqual([
            ['Hari ini', ['a', 'b']],
            ['Kemarin', ['c']],
        ]);
    });
});

describe('titleSegments', () => {
    it('emphasises the actor and the subject code', () => {
        expect(
            titleSegments('Sari Wulandari menyebut Anda di PLQ-15', [
                'Sari Wulandari',
                'PLQ-15',
            ]),
        ).toEqual([
            { text: 'Sari Wulandari', strong: true },
            { text: ' menyebut Anda di ', strong: false },
            { text: 'PLQ-15', strong: true },
        ]);
    });

    it('ignores missing, absent and overlapping highlights', () => {
        expect(
            titleSegments('OPS-127 melewati tenggat', [
                null,
                'OPS-127',
                'OPS',
                'Budi',
            ]),
        ).toEqual([
            { text: 'OPS-127', strong: true },
            { text: ' melewati tenggat', strong: false },
        ]);
        expect(titleSegments('Pengumuman', [])).toEqual([
            { text: 'Pengumuman', strong: false },
        ]);
    });
});

describe('fromBroadcast', () => {
    it('turns a realtime payload into an unread Inbox item', () => {
        const payload: BroadcastedNotification = {
            id: 'x',
            type: 'task.overdue',
            title: 'OPS-127 melewati tenggat',
            body: null,
            url: '/tugas',
            actor: null,
            subject: null,
            meta: [],
            category: 'task',
            icon: 'alert',
            tone: 'danger',
            action_required: true,
            created_at: '2026-10-05T01:00:00Z',
        };

        expect(fromBroadcast(payload)).toMatchObject({
            id: 'x',
            meta: {},
            read_at: null,
            archived_at: null,
            action_required: true,
        });
    });
});

describe('matchesFilters', () => {
    const base = { tab: 'all', kind: null, archived: false } as const;

    it('matches the current tab and kind', () => {
        expect(matchesFilters(item(), base)).toBe(true);
        expect(matchesFilters(item(), { ...base, archived: true })).toBe(false);
        expect(matchesFilters(item(), { ...base, tab: 'action' })).toBe(false);
        expect(
            matchesFilters(item({ action_required: true }), {
                ...base,
                tab: 'action',
            }),
        ).toBe(true);
        expect(matchesFilters(item(), { ...base, kind: 'mention' })).toBe(true);
        expect(
            matchesFilters(item({ type: 'task.assigned' }), {
                ...base,
                kind: 'mention',
            }),
        ).toBe(false);
        expect(matchesFilters(item(), { ...base, kind: 'request' })).toBe(
            false,
        );
    });
});
