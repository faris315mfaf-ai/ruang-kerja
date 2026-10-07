import type { RichNode } from '../editor/types';
import type { Person } from '../types';
import type { CommentRead, TaskComment, TimelineItem } from './types';

/*
 * Tanda baca komentar ("Dibaca oleh"): pure helpers over the read pointers of
 * the task detail (task_comment_reads). A pointer covers every comment whose
 * (created_at, id) is not after (last_read_at, last_read_comment_id) — the
 * same order as the timeline.
 */

type Position = { at: string; id: string };

function time(value: string): number {
    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? 0 : parsed;
}

/** Negative when `a` comes before `b` in the timeline. */
export function comparePosition(a: Position, b: Position): number {
    const diff = time(a.at) - time(b.at);

    if (diff !== 0) {
        return diff;
    }

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function positionOf(comment: TaskComment): Position {
    return { at: comment.created_at, id: comment.id };
}

function pointerOf(read: CommentRead): Position {
    return { at: read.last_read_at, id: read.last_read_comment_id };
}

/** Has this pointer reached the comment? */
export function covers(read: CommentRead, comment: TaskComment): boolean {
    return comparePosition(positionOf(comment), pointerOf(read)) <= 0;
}

function comments(timeline: TimelineItem[]): TaskComment[] {
    return timeline.filter(
        (item): item is TaskComment => item.kind === 'comment',
    );
}

/**
 * The comment the viewer's pointer should move to: the newest visible
 * comment written by someone else, when the viewer has not reached it yet.
 * Null = nothing new to report (no request).
 */
export function readTarget(
    timeline: TimelineItem[],
    reads: CommentRead[],
    viewerId: string | null | undefined,
): string | null {
    if (!viewerId) {
        return null;
    }

    const newest = comments(timeline)
        .filter((comment) => !comment.deleted && comment.author.id !== viewerId)
        .reduce<TaskComment | null>(
            (latest, comment) =>
                !latest ||
                comparePosition(positionOf(comment), positionOf(latest)) > 0
                    ? comment
                    : latest,
            null,
        );

    if (!newest) {
        return null;
    }

    const own = reads.find((read) => read.user.id === viewerId);

    return own && covers(own, newest) ? null : newest.id;
}

/**
 * Comments that show a receipt: the newest comment of the discussion and
 * the viewer's own newest comment (when that is an older one). Deleted
 * comments never do.
 */
export function receiptCommentIds(
    timeline: TimelineItem[],
    viewerId: string | null | undefined,
): Set<string> {
    const visible = comments(timeline).filter((comment) => !comment.deleted);
    const ids = new Set<string>();
    const last = visible.at(-1);

    if (last) {
        ids.add(last.id);
    }

    const mine = visible.filter((comment) => comment.author.id === viewerId);
    const ownLast = mine.at(-1);

    if (ownLast) {
        ids.add(ownLast.id);
    }

    return ids;
}

/**
 * People (not the author, not the viewer) whose pointer covers the comment,
 * most recent reader first.
 */
export function readersOf(
    comment: TaskComment,
    reads: CommentRead[],
    viewerId: string | null | undefined,
): CommentRead[] {
    return reads
        .filter(
            (read) =>
                read.user.id !== comment.author.id &&
                read.user.id !== viewerId &&
                covers(read, comment),
        )
        .sort((a, b) => time(b.read_at) - time(a.read_at));
}

/** People @mentioned in a comment body (mention nodes keep the real name). */
export function mentionedPeople(node: RichNode | null): Person[] {
    const found = new Map<string, Person>();

    const walk = (current: RichNode) => {
        const id = current.attrs?.id;

        if (current.type === 'mention' && typeof id === 'string') {
            const label = current.attrs?.label;
            found.set(id, {
                id,
                name: typeof label === 'string' && label !== '' ? label : id,
                avatar: null,
            });
        }

        current.content?.forEach(walk);
    };

    if (node) {
        walk(node);
    }

    return [...found.values()];
}

/** Mentioned people (not the author, not the viewer) who have not read the comment yet. */
export function unreadMentions(
    comment: TaskComment,
    reads: CommentRead[],
    viewerId: string | null | undefined,
): Person[] {
    const readers = new Set(
        reads.filter((read) => covers(read, comment)).map((r) => r.user.id),
    );

    return mentionedPeople(comment.body).filter(
        (person) =>
            person.id !== comment.author.id &&
            person.id !== viewerId &&
            !readers.has(person.id),
    );
}

/**
 * Applies a pointer (own request or `comment.read` event): replaces the
 * person's entry only when it moves forward. Same array when nothing changes.
 */
export function upsertRead(
    reads: CommentRead[],
    incoming: CommentRead,
): CommentRead[] {
    const index = reads.findIndex((read) => read.user.id === incoming.user.id);

    if (index < 0) {
        return [...reads, incoming];
    }

    if (comparePosition(pointerOf(incoming), pointerOf(reads[index])) <= 0) {
        return reads;
    }

    const next = [...reads];
    next[index] = incoming;

    return next;
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

/** "Rizky", "Rizky dan Sari", "Rizky, Sari dan Maya", "Rizky, Sari +2". */
export function namesLabel(people: Person[]): string {
    const names = people.map((person) => firstName(person.name));

    if (names.length <= 1) {
        return names[0] ?? '';
    }

    if (names.length === 2) {
        return `${names[0]} dan ${names[1]}`;
    }

    if (names.length === 3) {
        return `${names[0]}, ${names[1]} dan ${names[2]}`;
    }

    return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

/** Accessible summary of a receipt, e.g. "Dibaca oleh Rizky dan Sari. Belum dibaca: Maya". */
export function receiptSummary(
    readers: CommentRead[],
    pending: Person[],
): string {
    const parts: string[] = [];

    if (readers.length > 0) {
        parts.push(
            `Dibaca oleh ${namesLabel(readers.map((read) => read.user))}`,
        );
    }

    if (pending.length > 0) {
        parts.push(`Belum dibaca: ${namesLabel(pending)}`);
    }

    return parts.length > 0 ? `${parts.join('. ')}.` : 'Belum dibaca.';
}
