/**
 * Board presence per card (pure logic, no Echo): who has which task of the
 * workspace open, and who is typing in it.
 *
 * Source: one presence channel per workspace (`presence-workspace.{id}`).
 * Membership (`here`/`joining`/`leaving`) comes from the server and carries
 * the authorized identity; each open task detail (sheet or page) whispers
 * `{ tab, task_id, typing }` when it opens/closes, every HEARTBEAT_MS while
 * open, and (throttled) while the person types. Entries without a whisper
 * for STALE_MS expire (closed laptop, crashed tab); typing expires after
 * TYPING_MS of silence.
 */

export type TypingField = 'description' | 'comment';

/** user_info of presence-workspace.{id} (routes/channels.php). */
export type PresenceMember = {
    id: string;
    name: string;
    avatar: string | null;
    /** View-only management or archived workspace: typing hints are ignored. */
    read_only?: boolean;
};

/** Payload of the `viewing` whisper. */
export type ViewingWhisper = {
    /** Sender as claimed by the client; Reverb's authenticated user_id wins. */
    user_id?: string;
    /** One browser tab: several tabs of one person count separately. */
    tab: string;
    task_id: string | null;
    typing?: TypingField | null;
};

type Session = {
    userId: string;
    taskId: string;
    seenAt: number;
    typing: TypingField | null;
    typingAt: number;
};

export type PresenceState = {
    members: Readonly<Record<string, PresenceMember>>;
    /** Keyed by `${userId}|${tab}`. */
    sessions: Readonly<Record<string, Session>>;
};

export type PresenceAction =
    | { type: 'here'; members: PresenceMember[]; now: number }
    | { type: 'joining'; member: PresenceMember }
    | { type: 'leaving'; member: Pick<PresenceMember, 'id'> }
    | {
          type: 'whisper';
          /** Authenticated sender (whisper metadata), when the server adds it. */
          userId: string | null;
          payload: ViewingWhisper;
          now: number;
      }
    | { type: 'tick'; now: number }
    | { type: 'reset' };

/** A whisper is sent at least this often while a task stays open. */
export const HEARTBEAT_MS = 12_000;
/** No whisper for this long: the session is dropped. */
export const STALE_MS = 30_000;
/** No typing whisper for this long: the "sedang diedit" hint disappears. */
export const TYPING_MS = 6_000;
/** Typing whispers are sent at most this often. */
export const TYPING_THROTTLE_MS = 2_500;

export const EMPTY_PRESENCE: PresenceState = { members: {}, sessions: {} };

const TYPING_FIELDS: readonly TypingField[] = ['description', 'comment'];

function isMember(value: unknown): value is PresenceMember {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const member = value as Record<string, unknown>;

    return typeof member.id === 'string' && typeof member.name === 'string';
}

function memberOf(value: PresenceMember): PresenceMember {
    return {
        id: value.id,
        name: value.name,
        avatar: typeof value.avatar === 'string' ? value.avatar : null,
        read_only: value.read_only === true,
    };
}

function withoutUser(
    sessions: PresenceState['sessions'],
    keep: (userId: string) => boolean,
): PresenceState['sessions'] {
    const entries = Object.entries(sessions);
    const kept = entries.filter(([, session]) => keep(session.userId));

    return kept.length === entries.length ? sessions : Object.fromEntries(kept);
}

function applyWhisper(
    state: PresenceState,
    userId: string | null,
    payload: ViewingWhisper,
    now: number,
): PresenceState {
    if (typeof payload !== 'object' || payload === null) {
        return state;
    }

    const sender =
        userId ?? (typeof payload.user_id === 'string' ? payload.user_id : '');
    const member = state.members[sender];

    // Only people the server admitted to the channel.
    if (!member || typeof payload.tab !== 'string' || payload.tab === '') {
        return state;
    }

    const key = `${sender}|${payload.tab}`;
    const previous = state.sessions[key];

    if (typeof payload.task_id !== 'string' || payload.task_id === '') {
        if (!previous) {
            return state;
        }

        const { [key]: _closed, ...sessions } = state.sessions;

        return { ...state, sessions };
    }

    const typing =
        !member.read_only &&
        payload.typing &&
        TYPING_FIELDS.includes(payload.typing)
            ? payload.typing
            : null;
    const sameTask = previous?.taskId === payload.task_id;

    return {
        ...state,
        sessions: {
            ...state.sessions,
            [key]: {
                userId: sender,
                taskId: payload.task_id,
                seenAt: now,
                // A heartbeat without typing keeps a recent typing hint alive
                // until TYPING_MS runs out; another task resets it.
                typing: typing ?? (sameTask ? previous.typing : null),
                typingAt: typing ? now : sameTask ? previous.typingAt : 0,
            },
        },
    };
}

function expire(state: PresenceState, now: number): PresenceState {
    let changed = false;
    const sessions: Record<string, Session> = {};

    for (const [key, session] of Object.entries(state.sessions)) {
        if (now - session.seenAt >= STALE_MS) {
            changed = true;
            continue;
        }

        if (session.typing && now - session.typingAt >= TYPING_MS) {
            changed = true;
            sessions[key] = { ...session, typing: null, typingAt: 0 };
            continue;
        }

        sessions[key] = session;
    }

    return changed ? { ...state, sessions } : state;
}

/** Returns the same object when nothing changed (no re-render). */
export function presenceReducer(
    state: PresenceState,
    action: PresenceAction,
): PresenceState {
    switch (action.type) {
        case 'here': {
            const members = Object.fromEntries(
                action.members
                    .filter(isMember)
                    .map((member) => [member.id, memberOf(member)]),
            );

            return expire(
                {
                    members,
                    sessions: withoutUser(
                        state.sessions,
                        (userId) => userId in members,
                    ),
                },
                action.now,
            );
        }
        case 'joining':
            if (!isMember(action.member)) {
                return state;
            }

            return {
                ...state,
                members: {
                    ...state.members,
                    [action.member.id]: memberOf(action.member),
                },
            };
        case 'leaving': {
            const id = action.member?.id;

            if (typeof id !== 'string' || !(id in state.members)) {
                return state;
            }

            const { [id]: _left, ...members } = state.members;

            return {
                members,
                sessions: withoutUser(
                    state.sessions,
                    (userId) => userId !== id,
                ),
            };
        }
        case 'whisper':
            return applyWhisper(
                state,
                action.userId,
                action.payload,
                action.now,
            );
        case 'tick':
            return expire(state, action.now);
        case 'reset':
            return EMPTY_PRESENCE;
    }
}

/** What one card shows. Lists are ordered by name and never contain the viewer. */
export type TaskPresence = {
    viewers: PresenceMember[];
    /** Subset of viewers typing right now, with what they type in. */
    typing: { member: PresenceMember; field: TypingField }[];
};

export type TaskPresenceMap = ReadonlyMap<string, TaskPresence>;

export const EMPTY_TASK_PRESENCE: TaskPresenceMap = new Map();

function samePresence(a: TaskPresence, b: TaskPresence): boolean {
    return (
        a.viewers.length === b.viewers.length &&
        a.typing.length === b.typing.length &&
        a.viewers.every(
            (member, index) =>
                member.id === b.viewers[index].id &&
                member.name === b.viewers[index].name &&
                member.avatar === b.viewers[index].avatar,
        ) &&
        a.typing.every(
            (entry, index) =>
                entry.member.id === b.typing[index].member.id &&
                entry.field === b.typing[index].field,
        )
    );
}

const byName = (a: PresenceMember, b: PresenceMember) =>
    a.name.localeCompare(b.name, 'id') || a.id.localeCompare(b.id);

/**
 * Presence per task id for everyone but the viewer. Pass the previous result
 * to keep unchanged entries (and the map itself) referentially equal, so
 * memoized cards only re-render when their own presence changes.
 */
export function selectTaskPresence(
    state: PresenceState,
    viewerId: string | null | undefined,
    previous: TaskPresenceMap = EMPTY_TASK_PRESENCE,
): TaskPresenceMap {
    const viewers = new Map<string, Map<string, PresenceMember>>();
    const typing = new Map<string, Map<string, TypingField>>();

    for (const session of Object.values(state.sessions)) {
        const member = state.members[session.userId];

        if (!member || session.userId === viewerId) {
            continue;
        }

        const people = viewers.get(session.taskId) ?? new Map();
        people.set(member.id, member);
        viewers.set(session.taskId, people);

        if (session.typing) {
            const typists = typing.get(session.taskId) ?? new Map();
            // Description wins over comment when two tabs type at once.
            if (typists.get(member.id) !== 'description') {
                typists.set(member.id, session.typing);
            }
            typing.set(session.taskId, typists);
        }
    }

    const next = new Map<string, TaskPresence>();

    for (const [taskId, people] of viewers) {
        const sorted = [...people.values()].sort(byName);
        const typists = typing.get(taskId);
        const entry: TaskPresence = {
            viewers: sorted,
            typing: typists
                ? sorted
                      .filter((member) => typists.has(member.id))
                      .map((member) => ({
                          member,
                          field: typists.get(member.id) as TypingField,
                      }))
                : [],
        };
        const old = previous.get(taskId);
        next.set(taskId, old && samePresence(old, entry) ? old : entry);
    }

    if (
        next.size === previous.size &&
        [...next].every(([taskId, entry]) => previous.get(taskId) === entry)
    ) {
        return previous;
    }

    return next.size === 0 ? EMPTY_TASK_PRESENCE : next;
}

/** Earliest moment a tick would change the state (null: nothing to expire). */
export function nextExpiry(state: PresenceState): number | null {
    let next: number | null = null;

    for (const session of Object.values(state.sessions)) {
        const at = Math.min(
            session.seenAt + STALE_MS,
            session.typing ? session.typingAt + TYPING_MS : Infinity,
        );
        next = next === null ? at : Math.min(next, at);
    }

    return next;
}

function firstName(name: string): string {
    return name.split(' ')[0] || name;
}

/** "Sedang dilihat Sari", "Sedang dilihat Sari dan Rizky", "Sedang dilihat Sari +2". */
export function viewersLabel(viewers: PresenceMember[]): string | null {
    if (viewers.length === 0) {
        return null;
    }

    const first = firstName(viewers[0].name);

    if (viewers.length === 1) {
        return `Sedang dilihat ${first}`;
    }

    if (viewers.length === 2) {
        return `Sedang dilihat ${first} dan ${firstName(viewers[1].name)}`;
    }

    return `Sedang dilihat ${first} +${viewers.length - 1}`;
}

/**
 * Typing hint of a card: "sedang diedit oleh Sari" (description, or several
 * people: "sedang diedit oleh Sari +1"); "Sari sedang berkomentar" when the
 * only typist writes a comment.
 */
export function typingLabel(presence: TaskPresence | undefined): string | null {
    const typists = presence?.typing ?? [];

    if (typists.length === 0) {
        return null;
    }

    const editor =
        typists.find((entry) => entry.field === 'description') ?? typists[0];
    const first = firstName(editor.member.name);

    if (typists.length === 1 && editor.field === 'comment') {
        return `${first} sedang berkomentar`;
    }

    return typists.length === 1
        ? `sedang diedit oleh ${first}`
        : `sedang diedit oleh ${first} +${typists.length - 1}`;
}
