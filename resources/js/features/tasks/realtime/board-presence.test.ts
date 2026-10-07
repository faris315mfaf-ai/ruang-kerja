import { describe, expect, it } from 'vite-plus/test';
import type { PresenceAction, PresenceState } from './board-presence';
import {
    EMPTY_PRESENCE,
    EMPTY_TASK_PRESENCE,
    STALE_MS,
    TYPING_MS,
    nextExpiry,
    presenceReducer,
    selectTaskPresence,
    typingInCommentOnly,
    typingLabel,
    viewersLabel,
} from './board-presence';

const sari = { id: 'u-sari', name: 'Sari Wulandari', avatar: null };
const rizky = { id: 'u-rizky', name: 'Rizky Ananda', avatar: '/r.png' };
const dimas = { id: 'u-dimas', name: 'Dimas Pratama', avatar: null };
const hana = {
    id: 'u-hana',
    name: 'Hana Pratiwi',
    avatar: null,
    read_only: true,
};

function run(actions: PresenceAction[], start = EMPTY_PRESENCE) {
    return actions.reduce(presenceReducer, start);
}

const here = (now = 0): PresenceAction => ({
    type: 'here',
    members: [sari, rizky, dimas, hana],
    now,
});

function whisper(
    userId: string | null,
    payload: {
        user_id?: string;
        tab?: string;
        task_id: string | null;
        typing?: 'description' | 'comment' | null;
    },
    now = 0,
): PresenceAction {
    return {
        type: 'whisper',
        userId,
        payload: { tab: 't1', ...payload },
        now,
    };
}

function viewersOf(state: PresenceState, taskId: string, viewer = 'u-dimas') {
    return (
        selectTaskPresence(state, viewer)
            .get(taskId)
            ?.viewers.map((member) => member.id) ?? []
    );
}

describe('presenceReducer', () => {
    it('records which task a member has open', () => {
        const state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1' }),
            whisper('u-rizky', { task_id: 'task-1' }),
            whisper('u-rizky', { tab: 't2', task_id: 'task-2' }),
        ]);

        expect(viewersOf(state, 'task-1')).toEqual(['u-rizky', 'u-sari']);
        expect(viewersOf(state, 'task-2')).toEqual(['u-rizky']);
    });

    it('moves a tab to the newly opened task and forgets it when closed', () => {
        let state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1' }),
            whisper('u-sari', { task_id: 'task-2' }),
        ]);

        expect(viewersOf(state, 'task-1')).toEqual([]);
        expect(viewersOf(state, 'task-2')).toEqual(['u-sari']);

        state = presenceReducer(state, whisper('u-sari', { task_id: null }));
        expect(state.sessions).toEqual({});
    });

    it('ignores whispers from people the server did not admit', () => {
        const before = run([here()]);

        expect(
            presenceReducer(
                before,
                whisper('u-stranger', { task_id: 'task-1' }),
            ),
        ).toBe(before);
        expect(
            presenceReducer(
                EMPTY_PRESENCE,
                whisper('u-sari', { task_id: 'task-1' }),
            ),
        ).toBe(EMPTY_PRESENCE);
    });

    it('trusts the authenticated sender over the claimed user_id', () => {
        const state = run([
            here(),
            whisper('u-sari', { user_id: 'u-rizky', task_id: 'task-1' }),
        ]);

        expect(viewersOf(state, 'task-1')).toEqual(['u-sari']);
    });

    it('falls back to the claimed user_id without server metadata', () => {
        const state = run([
            here(),
            whisper(null, { user_id: 'u-rizky', task_id: 'task-1' }),
        ]);

        expect(viewersOf(state, 'task-1')).toEqual(['u-rizky']);
    });

    it('rejects malformed whispers', () => {
        const before = run([here()]);
        const broken = {
            type: 'whisper',
            userId: 'u-sari',
            payload: { tab: '', task_id: 'task-1' },
            now: 0,
        } as PresenceAction;

        expect(presenceReducer(before, broken)).toBe(before);
        expect(
            presenceReducer(before, {
                type: 'whisper',
                userId: 'u-sari',
                payload: null as never,
                now: 0,
            }),
        ).toBe(before);
    });

    it('adds joining members and drops every tab of a member who leaves', () => {
        const newcomer = { id: 'u-new', name: 'Nina', avatar: null };
        let state = run([
            here(),
            { type: 'joining', member: newcomer },
            whisper('u-new', { task_id: 'task-1' }),
            whisper('u-sari', { task_id: 'task-1' }),
            whisper('u-sari', { tab: 't2', task_id: 'task-3' }),
        ]);

        expect(viewersOf(state, 'task-1')).toEqual(['u-new', 'u-sari']);

        state = presenceReducer(state, { type: 'leaving', member: sari });

        expect(viewersOf(state, 'task-1')).toEqual(['u-new']);
        expect(viewersOf(state, 'task-3')).toEqual([]);
        expect(state.members['u-sari']).toBeUndefined();
    });

    it('keeps the state when an unknown member leaves', () => {
        const state = run([here()]);

        expect(
            presenceReducer(state, { type: 'leaving', member: { id: 'x' } }),
        ).toBe(state);
    });

    it('drops sessions of people missing from a fresh member list (reconnect)', () => {
        const state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1' }),
            whisper('u-rizky', { task_id: 'task-1' }),
            { type: 'here', members: [rizky, dimas], now: 1_000 },
        ]);

        expect(viewersOf(state, 'task-1')).toEqual(['u-rizky']);
    });

    it('expires a session after STALE_MS without a heartbeat', () => {
        let state = run([here(), whisper('u-sari', { task_id: 'task-1' }, 0)]);

        state = presenceReducer(state, { type: 'tick', now: STALE_MS - 1 });
        expect(viewersOf(state, 'task-1')).toEqual(['u-sari']);

        // A heartbeat keeps it alive.
        state = presenceReducer(
            state,
            whisper('u-sari', { task_id: 'task-1' }, STALE_MS - 1),
        );
        state = presenceReducer(state, { type: 'tick', now: STALE_MS + 5 });
        expect(viewersOf(state, 'task-1')).toEqual(['u-sari']);

        state = presenceReducer(state, {
            type: 'tick',
            now: 2 * STALE_MS - 1,
        });
        expect(viewersOf(state, 'task-1')).toEqual([]);
    });

    it('returns the same state when a tick changes nothing', () => {
        const state = run([here(), whisper('u-sari', { task_id: 'task-1' })]);

        expect(presenceReducer(state, { type: 'tick', now: 1_000 })).toBe(
            state,
        );
    });

    it('shows typing until TYPING_MS of silence, across heartbeats', () => {
        let state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1', typing: 'description' }, 0),
            // Heartbeat without typing does not clear the hint early.
            whisper('u-sari', { task_id: 'task-1' }, 2_000),
        ]);

        expect(
            typingLabel(selectTaskPresence(state, 'u-dimas').get('task-1')),
        ).toBe('sedang diedit oleh Sari');

        state = presenceReducer(state, { type: 'tick', now: TYPING_MS });
        const presence = selectTaskPresence(state, 'u-dimas').get('task-1');

        expect(presence?.typing).toEqual([]);
        expect(presence?.viewers.map((member) => member.id)).toEqual([
            'u-sari',
        ]);
    });

    it('clears typing when the tab switches to another task', () => {
        const state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1', typing: 'comment' }, 0),
            whisper('u-sari', { task_id: 'task-2' }, 100),
        ]);

        expect(
            selectTaskPresence(state, 'u-dimas').get('task-2')?.typing,
        ).toEqual([]);
    });

    it('ignores typing from read-only members and unknown fields', () => {
        const state = run([
            here(),
            whisper('u-hana', { task_id: 'task-1', typing: 'comment' }),
            whisper('u-sari', {
                task_id: 'task-1',
                typing: 'title' as 'comment',
            }),
        ]);
        const presence = selectTaskPresence(state, 'u-dimas').get('task-1');

        expect(presence?.viewers.map((member) => member.id)).toEqual([
            'u-hana',
            'u-sari',
        ]);
        expect(presence?.typing).toEqual([]);
    });
});

describe('selectTaskPresence', () => {
    it('never lists the viewer and dedupes tabs of one person', () => {
        const state = run([
            here(),
            whisper('u-dimas', { task_id: 'task-1' }),
            whisper('u-sari', { task_id: 'task-1' }),
            whisper('u-sari', { tab: 't2', task_id: 'task-1' }),
        ]);

        expect(viewersOf(state, 'task-1', 'u-dimas')).toEqual(['u-sari']);
        expect(viewersOf(state, 'task-1', 'u-sari')).toEqual(['u-dimas']);
    });

    it('keeps unchanged entries and the map referentially equal', () => {
        const first = run([
            here(),
            whisper('u-sari', { task_id: 'task-1' }),
            whisper('u-rizky', { task_id: 'task-2' }),
        ]);
        const before = selectTaskPresence(first, 'u-dimas');

        // Heartbeat: new state object, same presence.
        const heartbeat = presenceReducer(
            first,
            whisper('u-sari', { task_id: 'task-1' }, 5_000),
        );
        expect(selectTaskPresence(heartbeat, 'u-dimas', before)).toBe(before);

        // Typing on task-1: task-2 entry is reused.
        const typing = presenceReducer(
            heartbeat,
            whisper('u-sari', { task_id: 'task-1', typing: 'comment' }, 6_000),
        );
        const after = selectTaskPresence(typing, 'u-dimas', before);

        expect(after).not.toBe(before);
        expect(after.get('task-2')).toBe(before.get('task-2'));
        expect(after.get('task-1')).not.toBe(before.get('task-1'));
    });

    it('returns the shared empty map when nobody else is around', () => {
        const state = run([here(), whisper('u-dimas', { task_id: 'task-1' })]);

        expect(selectTaskPresence(state, 'u-dimas')).toBe(EMPTY_TASK_PRESENCE);
    });

    it('prefers the description when one person types in two tabs', () => {
        const state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1', typing: 'comment' }),
            whisper('u-sari', {
                tab: 't2',
                task_id: 'task-1',
                typing: 'description',
            }),
        ]);

        expect(
            selectTaskPresence(state, 'u-dimas').get('task-1')?.typing,
        ).toEqual([
            {
                member: expect.objectContaining({ id: 'u-sari' }),
                field: 'description',
            },
        ]);
    });
});

describe('nextExpiry', () => {
    it('is the earliest stale or typing deadline', () => {
        expect(nextExpiry(EMPTY_PRESENCE)).toBeNull();

        const state = run([
            here(),
            whisper('u-sari', { task_id: 'task-1' }, 1_000),
            whisper('u-rizky', { task_id: 'task-1', typing: 'comment' }, 2_000),
        ]);

        expect(nextExpiry(state)).toBe(2_000 + TYPING_MS);
    });
});

describe('labels', () => {
    it('names the viewers', () => {
        expect(viewersLabel([])).toBeNull();
        expect(viewersLabel([sari])).toBe('Sedang dilihat Sari');
        expect(viewersLabel([sari, rizky])).toBe(
            'Sedang dilihat Sari dan Rizky',
        );
        expect(viewersLabel([sari, rizky, dimas])).toBe(
            'Sedang dilihat Sari +2',
        );
    });

    it('describes who types where', () => {
        expect(typingLabel(undefined)).toBeNull();
        expect(
            typingLabel({
                viewers: [sari],
                typing: [{ member: sari, field: 'comment' }],
            }),
        ).toBe('Sari sedang berkomentar');
        expect(
            typingLabel({
                viewers: [rizky, sari],
                typing: [
                    { member: rizky, field: 'comment' },
                    { member: sari, field: 'description' },
                ],
            }),
        ).toBe('sedang diedit oleh Sari +1');
    });

    it('tells comment typing from description editing', () => {
        expect(typingInCommentOnly(undefined)).toBe(false);
        expect(
            typingInCommentOnly({
                viewers: [sari],
                typing: [{ member: sari, field: 'comment' }],
            }),
        ).toBe(true);
        expect(
            typingInCommentOnly({
                viewers: [rizky, sari],
                typing: [
                    { member: rizky, field: 'comment' },
                    { member: sari, field: 'description' },
                ],
            }),
        ).toBe(false);
    });

    it('has a short variant for narrow board cards', () => {
        expect(
            typingLabel(
                {
                    viewers: [sari],
                    typing: [{ member: sari, field: 'description' }],
                },
                'short',
            ),
        ).toBe('mengetik…');
        expect(
            typingLabel(
                {
                    viewers: [sari],
                    typing: [{ member: sari, field: 'comment' }],
                },
                'short',
            ),
        ).toBe('mengetik…');
        expect(
            typingLabel(
                {
                    viewers: [rizky, sari],
                    typing: [
                        { member: rizky, field: 'comment' },
                        { member: sari, field: 'comment' },
                    ],
                },
                'short',
            ),
        ).toBe('mengetik…');
    });
});
