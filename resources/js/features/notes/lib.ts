import type { RichNode } from '@/features/tasks/editor/types';
import type { Note, NoteShare } from './types';

export type TreeNode = { note: Note; depth: number; children: TreeNode[] };

/** Plain text of a Tiptap document (search, word count). */
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

function byTitle(a: Note, b: Note): number {
    return a.title.localeCompare(b.title, 'id');
}

/**
 * Parent/child tree of a workspace's notes (alphabetical). With a query,
 * keeps notes whose title or text contains every word plus their
 * ancestors, so a match is never shown without its path.
 */
export function buildTree(notes: Note[], query = ''): TreeNode[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const byId = new Map(notes.map((note) => [note.id, note]));
    let keep: Set<string>;

    if (words.length === 0) {
        keep = new Set(notes.map((note) => note.id));
    } else {
        keep = new Set();

        for (const note of notes) {
            const haystack =
                `${note.title}\n${docText(note.content)}`.toLowerCase();

            if (words.every((word) => haystack.includes(word))) {
                let current: Note | undefined = note;

                while (current && !keep.has(current.id)) {
                    keep.add(current.id);
                    current = current.parent_id
                        ? byId.get(current.parent_id)
                        : undefined;
                }
            }
        }
    }

    const build = (parentId: string | null, depth: number): TreeNode[] =>
        notes
            .filter(
                (note) =>
                    keep.has(note.id) &&
                    (note.parent_id === parentId ||
                        // Orphans (parent missing) sit at the root.
                        (parentId === null &&
                            note.parent_id !== null &&
                            !byId.has(note.parent_id))),
            )
            .sort(byTitle)
            .map((note) => ({
                note,
                depth,
                children: build(note.id, depth + 1),
            }));

    return build(null, 0);
}

/** Depth-first list of the tree, skipping children of collapsed notes. */
export function flattenTree(
    tree: TreeNode[],
    collapsed: Set<string> = new Set(),
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

/** Can the viewer edit? Restricted notes need an "edit" invitation. */
export function canEdit(share: NoteShare | undefined, userId: string): boolean {
    if (!share) {
        return true;
    }

    const person = share.people.find((item) => item.user_id === userId);

    if (share.access === 'restricted') {
        return person?.role === 'edit';
    }

    return person?.role !== 'view';
}

/**
 * Position of a simulated collaborator caret: walks the text blocks of the
 * document (`blocks` = [start, end] positions) with a per-person offset.
 */
export function cursorAt(
    blocks: [number, number][],
    tick: number,
    seat: number,
): number | null {
    if (blocks.length === 0) {
        return null;
    }

    const [start, end] = blocks[(tick + seat * 3) % blocks.length];
    const length = Math.max(0, end - start);
    const offset = length === 0 ? 0 : ((tick * 7 + seat * 13) % length) + 1;

    return Math.min(end, start + offset);
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
