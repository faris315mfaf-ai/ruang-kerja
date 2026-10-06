import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** Token classes per collaborator seat (caret, label, selection). */
export const CURSOR_TONES = [
    {
        caret: 'bg-fill-violet',
        label: 'bg-fill-violet text-on-brand',
        selection: 'bg-fill-violet/20',
        ring: 'ring-fill-violet',
    },
    {
        caret: 'bg-accent-blue-strong',
        label: 'bg-accent-blue-strong text-on-brand',
        selection: 'bg-accent-blue/20',
        ring: 'ring-accent-blue-strong',
    },
    {
        caret: 'bg-primary',
        label: 'bg-primary text-primary-foreground',
        selection: 'bg-primary/20',
        ring: 'ring-primary',
    },
] as const;

export type RemoteCursor = {
    id: string;
    name: string;
    seat: number;
    /** Caret position. */
    head: number;
    /** Selection start (= head for a plain caret). */
    anchor: number;
};

export const collabCursorsKey = new PluginKey<DecorationSet>('collabCursors');

function caretWidget(cursor: RemoteCursor): HTMLElement {
    const tone = CURSOR_TONES[cursor.seat % CURSOR_TONES.length];
    const caret = document.createElement('span');
    caret.className = `collab-caret pointer-events-none relative -mx-px inline-block h-[1.15em] w-0.5 align-text-bottom ${tone.caret}`;
    caret.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = `absolute bottom-full left-0 mb-0.5 rounded-xs px-1.5 py-px text-[11px] leading-4 font-bold whitespace-nowrap shadow-card ${tone.label}`;
    label.textContent = cursor.name.split(' ')[0];
    caret.appendChild(label);

    return caret;
}

function build(doc: PmNode, cursors: RemoteCursor[]): DecorationSet {
    const max = doc.content.size;
    const decorations: Decoration[] = [];

    for (const cursor of cursors) {
        const head = Math.max(0, Math.min(cursor.head, max));
        const anchor = Math.max(0, Math.min(cursor.anchor, max));

        if (anchor !== head) {
            const tone = CURSOR_TONES[cursor.seat % CURSOR_TONES.length];
            decorations.push(
                Decoration.inline(
                    Math.min(anchor, head),
                    Math.max(anchor, head),
                    { class: `rounded-[2px] ${tone.selection}` },
                ),
            );
        }

        decorations.push(
            Decoration.widget(head, () => caretWidget(cursor), {
                key: `${cursor.id}-${head}`,
                side: 1,
                ignoreSelection: true,
            }),
        );
    }

    return DecorationSet.create(doc, decorations);
}

/**
 * Shows other people's carets and selections (name label in their colour).
 * In production the positions come from Yjs awareness; here a timer feeds
 * them with `tr.setMeta(collabCursorsKey, cursors)`.
 */
export const CollabCursors = Extension.create({
    name: 'collabCursors',

    addProseMirrorPlugins() {
        return [
            new Plugin<DecorationSet>({
                key: collabCursorsKey,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, set) {
                        const cursors = tr.getMeta(collabCursorsKey) as
                            | RemoteCursor[]
                            | undefined;

                        if (cursors) {
                            return build(tr.doc, cursors);
                        }

                        return set.map(tr.mapping, tr.doc);
                    },
                },
                props: {
                    decorations(state) {
                        return collabCursorsKey.getState(state);
                    },
                },
            }),
        ];
    },
});

/** [start, end] content positions of every text block. */
export function textBlocks(doc: PmNode): [number, number][] {
    const blocks: [number, number][] = [];

    doc.descendants((node, pos) => {
        if (node.isTextblock) {
            blocks.push([pos + 1, pos + 1 + node.content.size]);

            return false;
        }

        return true;
    });

    return blocks;
}
