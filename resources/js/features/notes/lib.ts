import type { RichNode } from '@/features/tasks/editor/types';
import type { Note, NoteKind } from './types';

export type TreeNode = { note: Note; depth: number; children: TreeNode[] };

/** Plain text of a Tiptap document (word count). */
export function docText(node: RichNode | null | undefined): string {
    if (!node) {
        return '';
    }

    if (node.type === 'text') {
        return node.text ?? '';
    }

    const inner = (node.content ?? []).map(docText);
    const block = [
        'paragraph',
        'heading',
        'listItem',
        'taskItem',
        'blockquote',
        'codeBlock',
    ].includes(node.type);

    return block ? `${inner.join('')}\n` : inner.join('');
}

export function wordCount(node: RichNode | null | undefined): number {
    return docText(node).split(/\s+/).filter(Boolean).length;
}

/** Folders above notes, then the manual order (lexorank `position`). */
export function compareNotes(a: Note, b: Note): number {
    if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
    }

    if (a.position !== b.position) {
        return a.position < b.position ? -1 : 1;
    }

    return a.id < b.id ? -1 : 1;
}

/**
 * Parent/child tree of a workspace's notes and folders. With `matches`
 * (server search results), keeps the matching rows plus their ancestors, so
 * a match is never shown without its path. A row whose parent is not
 * visible sits at the root.
 */
export function buildTree(
    notes: Note[],
    matches: ReadonlySet<string> | null = null,
): TreeNode[] {
    const byId = new Map(notes.map((note) => [note.id, note]));
    let keep: Set<string>;

    if (matches === null) {
        keep = new Set(notes.map((note) => note.id));
    } else {
        keep = new Set();

        for (const note of notes) {
            if (!matches.has(note.id)) {
                continue;
            }

            let current: Note | undefined = note;

            while (current && !keep.has(current.id)) {
                keep.add(current.id);
                current = current.parent_id
                    ? byId.get(current.parent_id)
                    : undefined;
            }
        }
    }

    const build = (parentId: string | null, depth: number): TreeNode[] =>
        notes
            .filter(
                (note) =>
                    keep.has(note.id) &&
                    (note.parent_id === parentId ||
                        (parentId === null &&
                            note.parent_id !== null &&
                            !byId.has(note.parent_id))),
            )
            .sort(compareNotes)
            .map((note) => ({
                note,
                depth,
                children: depth > 30 ? [] : build(note.id, depth + 1),
            }));

    return build(null, 0);
}

/** Depth-first list of the tree, skipping children of collapsed rows. */
export function flattenTree(
    tree: TreeNode[],
    collapsed: ReadonlySet<string> = new Set(),
): TreeNode[] {
    return tree.flatMap((node) => [
        node,
        ...(collapsed.has(node.note.id)
            ? []
            : flattenTree(node.children, collapsed)),
    ]);
}

/** Ancestors from the root down to (not including) the note. */
export function ancestors(notes: Note[], id: string): Note[] {
    const byId = new Map(notes.map((note) => [note.id, note]));
    const path: Note[] = [];
    let current = byId.get(id);
    const seen = new Set<string>();

    while (current?.parent_id && !seen.has(current.parent_id)) {
        seen.add(current.parent_id);
        current = byId.get(current.parent_id);

        if (current) {
            path.unshift(current);
        }
    }

    return path;
}

/** The row and everything below it (it can never become its own parent). */
export function subtreeIds(notes: Note[], id: string): Set<string> {
    const ids = new Set([id]);
    let grew = true;

    while (grew) {
        grew = false;

        for (const note of notes) {
            if (
                note.parent_id &&
                ids.has(note.parent_id) &&
                !ids.has(note.id)
            ) {
                ids.add(note.id);
                grew = true;
            }
        }
    }

    return ids;
}

/**
 * Possible parents for a row of `kind` (MoveNote / CreateNote rules):
 * folders only inside folders, notes inside folders or notes; never the row
 * itself or one of its descendants.
 */
export function parentOptions(
    notes: Note[],
    kind: NoteKind,
    movingId: string | null = null,
): Note[] {
    const excluded = movingId ? subtreeIds(notes, movingId) : new Set();

    return flattenTree(buildTree(notes))
        .map((node) => node.note)
        .filter(
            (note) =>
                !excluded.has(note.id) &&
                (kind === 'note' || note.kind === 'folder'),
        );
}

/** Children count per row id (folder badges). */
export function childCounts(notes: Note[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const note of notes) {
        if (note.parent_id) {
            counts.set(note.parent_id, (counts.get(note.parent_id) ?? 0) + 1);
        }
    }

    return counts;
}

/** "Menyimpan…", "Tersimpan · baru saja", "Tersimpan · 2 dtk lalu", "· 3 mnt lalu". */
export function savedLabel(
    savedAt: number | null,
    now: number,
    saving: boolean,
): string {
    if (saving) {
        return 'Menyimpan…';
    }

    if (savedAt === null) {
        return 'Tersimpan';
    }

    const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));

    if (seconds < 2) {
        return 'Tersimpan · baru saja';
    }

    if (seconds < 60) {
        return `Tersimpan · ${seconds} dtk lalu`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `Tersimpan · ${minutes} mnt lalu`;
    }

    return `Tersimpan · ${Math.floor(minutes / 60)} jam lalu`;
}

/** "Hana dan Dewi sedang menyunting" / "3 orang sedang menyunting". */
export function editorsLabel(names: string[]): string | null {
    const first = names.map((name) => name.split(' ')[0]);

    if (first.length === 0) {
        return null;
    }

    if (first.length === 1) {
        return `${first[0]} sedang menyunting`;
    }

    if (first.length === 2) {
        return `${first[0]} dan ${first[1]} sedang menyunting`;
    }

    return `${first.length} orang sedang menyunting`;
}

/** "Tersambung · 3 orang" (the viewer included). */
export function connectedLabel(peers: number): string {
    return `Tersambung · ${peers + 1} orang`;
}

/** Stable colour seat of a person (index into CURSOR_TONES). */
export function toneFor(id: string, tones: number): number {
    let hash = 0;

    for (let index = 0; index < id.length; index++) {
        hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }

    return tones > 0 ? hash % tones : 0;
}
