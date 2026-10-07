import { describe, expect, it } from 'vite-plus/test';
import type { RichDoc } from '../editor/types';
import {
    comparePosition,
    covers,
    mentionedPeople,
    namesLabel,
    readTarget,
    readersOf,
    receiptCommentIds,
    receiptSummary,
    unreadMentions,
    upsertRead,
} from './comment-reads';
import type { CommentRead, TaskComment, TimelineItem } from './types';

const people = {
    dimas: { id: 'u-dimas', name: 'Dimas Pratama', avatar: null },
    rizky: { id: 'u-rizky', name: 'Rizky Aditya', avatar: null },
    sari: { id: 'u-sari', name: 'Sari Wulandari', avatar: null },
    maya: { id: 'u-maya', name: 'Maya Lestari', avatar: null },
};

const comment = (
    id: string,
    at: string,
    author: keyof typeof people,
    over: Partial<TaskComment> = {},
): TaskComment => ({
    kind: 'comment',
    id,
    task_id: 't',
    author: people[author],
    body: null,
    body_text: 'x',
    created_at: at,
    edited_at: null,
    deleted: false,
    reactions: [],
    attachments: [],
    ...over,
});

const read = (
    who: keyof typeof people,
    upTo: TaskComment,
    readAt = '2026-10-07T10:00:00+00:00',
): CommentRead => ({
    user: people[who],
    last_read_comment_id: upTo.id,
    last_read_at: upTo.created_at,
    read_at: readAt,
});

const mentionDoc = (...who: (keyof typeof people)[]): RichDoc => ({
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: who.map((key) => ({
                type: 'mention',
                attrs: { id: people[key].id, label: people[key].name },
            })),
        },
    ],
});

const a = comment('01a', '2026-10-07T09:00:00+00:00', 'dimas');
const b = comment('01b', '2026-10-07T09:05:00+00:00', 'rizky');
const c = comment('01c', '2026-10-07T09:05:00+00:00', 'sari');
const timeline: TimelineItem[] = [
    a,
    {
        kind: 'activity',
        id: 'x',
        event: 'task.renamed',
        properties: {},
        causer: null,
        created_at: '2026-10-07T09:01:00+00:00',
    },
    b,
    c,
];

describe('comparePosition / covers', () => {
    it('orders by time, then by id within the same second', () => {
        expect(
            comparePosition(
                { at: a.created_at, id: a.id },
                { at: b.created_at, id: b.id },
            ),
        ).toBeLessThan(0);
        expect(
            comparePosition(
                { at: c.created_at, id: c.id },
                { at: b.created_at, id: b.id },
            ),
        ).toBeGreaterThan(0);
        // Same instant written with another offset.
        expect(
            comparePosition(
                { at: '2026-10-07T16:05:00+07:00', id: b.id },
                { at: b.created_at, id: b.id },
            ),
        ).toBe(0);
    });

    it('covers every comment up to the pointer', () => {
        const pointer = read('maya', b);

        expect(covers(pointer, a)).toBe(true);
        expect(covers(pointer, b)).toBe(true);
        expect(covers(pointer, c)).toBe(false);
    });
});

describe('readTarget', () => {
    it('targets the newest comment of someone else until the viewer reached it', () => {
        expect(readTarget(timeline, [], 'u-maya')).toBe('01c');
        expect(readTarget(timeline, [read('maya', b)], 'u-maya')).toBe('01c');
        expect(readTarget(timeline, [read('maya', c)], 'u-maya')).toBeNull();
    });

    it("skips the viewer's own and deleted comments", () => {
        // Sari wrote the newest one: her target is Rizky's comment.
        expect(readTarget(timeline, [], 'u-sari')).toBe('01b');
        expect(
            readTarget(
                [a, comment('01d', b.created_at, 'rizky', { deleted: true })],
                [],
                'u-maya',
            ),
        ).toBe('01a');
        expect(readTarget([a], [], 'u-dimas')).toBeNull();
        expect(readTarget(timeline, [], null)).toBeNull();
    });
});

describe('receiptCommentIds', () => {
    it("marks the newest comment and the viewer's own newest one", () => {
        expect([...receiptCommentIds(timeline, 'u-dimas')].sort()).toEqual([
            '01a',
            '01c',
        ]);
        expect([...receiptCommentIds(timeline, 'u-sari')]).toEqual(['01c']);
        expect([
            ...receiptCommentIds(
                [a, comment('01z', c.created_at, 'rizky', { deleted: true })],
                'u-maya',
            ),
        ]).toEqual(['01a']);
    });
});

describe('readersOf', () => {
    it('lists covering readers without the author and the viewer, newest first', () => {
        const reads = [
            read('dimas', c, '2026-10-07T09:30:00+00:00'),
            read('rizky', b, '2026-10-07T09:10:00+00:00'),
            read('sari', c, '2026-10-07T09:40:00+00:00'),
            read('maya', a, '2026-10-07T09:50:00+00:00'),
        ];

        expect(readersOf(b, reads, 'u-maya').map((r) => r.user.id)).toEqual([
            'u-sari',
            'u-dimas',
        ]);
        expect(readersOf(a, reads, 'u-sari').map((r) => r.user.id)).toEqual([
            'u-maya',
            'u-rizky',
        ]);
    });
});

describe('mentions', () => {
    it('collects mentioned people once, with their names', () => {
        const doc = mentionDoc('rizky', 'sari', 'rizky');

        expect(mentionedPeople(doc).map((p) => p.name)).toEqual([
            'Rizky Aditya',
            'Sari Wulandari',
        ]);
        expect(mentionedPeople(null)).toEqual([]);
    });

    it('lists mentioned people who have not read the comment yet', () => {
        const mentioning = comment(
            '01e',
            '2026-10-07T09:20:00+00:00',
            'dimas',
            {
                body: mentionDoc('rizky', 'sari', 'dimas', 'maya'),
            },
        );
        const reads = [read('sari', mentioning)];

        expect(
            unreadMentions(mentioning, reads, 'u-maya').map((p) => p.id),
        ).toEqual(['u-rizky']);
    });
});

describe('upsertRead', () => {
    it('adds new readers and only moves pointers forward', () => {
        const reads = [read('rizky', b)];

        expect(upsertRead(reads, read('sari', a))).toHaveLength(2);
        expect(upsertRead(reads, read('rizky', a))).toBe(reads);
        expect(
            upsertRead(reads, read('rizky', c))[0].last_read_comment_id,
        ).toBe('01c');
    });
});

describe('labels', () => {
    it('joins first names in Indonesian', () => {
        const list = [people.rizky, people.sari, people.maya, people.dimas];

        expect(namesLabel(list.slice(0, 1))).toBe('Rizky');
        expect(namesLabel(list.slice(0, 2))).toBe('Rizky dan Sari');
        expect(namesLabel(list.slice(0, 3))).toBe('Rizky, Sari dan Maya');
        expect(namesLabel(list)).toBe('Rizky, Sari +2');
    });

    it('summarizes a receipt for screen readers', () => {
        expect(receiptSummary([read('rizky', a)], [people.sari])).toBe(
            'Dibaca oleh Rizky. Belum dibaca: Sari.',
        );
        expect(receiptSummary([], [])).toBe('Belum dibaca.');
    });
});
