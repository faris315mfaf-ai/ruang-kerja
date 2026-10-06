import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    Bold,
    Code,
    Heading2,
    Heading3,
    Italic,
    List,
    ListChecks,
    ListOrdered,
    Quote,
    Redo2,
    Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { RichDoc } from '@/features/tasks/editor/types';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn, focusRing } from '@/lib/utils';
import { CollabCursors, collabCursorsKey, textBlocks } from './collab-cursors';
import type { RemoteCursor } from './collab-cursors';
import { cursorAt } from './lib';
import type { NotePerson } from './types';

/**
 * Document-sized headings for notes (the shared .rich-text scale is tuned
 * for comments). Editor: h1–h3; read-only view renders levels as h3–h5.
 */
export const NOTE_PROSE = cn(
    '[&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:text-[26px] [&_.ProseMirror_h1]:leading-8 [&_.ProseMirror_h1]:font-bold',
    '[&_.ProseMirror_h2]:mt-7 [&_.ProseMirror_h2]:text-[22px] [&_.ProseMirror_h2]:leading-[30px] [&_.ProseMirror_h2]:font-bold',
    '[&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:text-[18px] [&_.ProseMirror_h3]:leading-[26px] [&_.ProseMirror_h3]:font-bold',
);

/** Same scale for RichTextView (heading levels 1/2/3 render as h3/h4/h5). */
export const NOTE_PROSE_VIEW = cn(
    '[&_h3]:mt-8 [&_h3]:text-[26px] [&_h3]:leading-8 [&_h3]:font-bold',
    '[&_h4]:mt-7 [&_h4]:text-[22px] [&_h4]:leading-[30px] [&_h4]:font-bold',
    '[&_h5]:mt-5 [&_h5]:text-[18px] [&_h5]:leading-[26px] [&_h5]:font-bold',
);

type Props = {
    /** Remount (key) to load another note or a restored version. */
    initial: RichDoc | null;
    editable: boolean;
    collaborators: NotePerson[];
    onChange: (doc: RichDoc | null) => void;
    onReady: (editor: Editor | null) => void;
    onFocusChange?: (focused: boolean) => void;
    className?: string;
};

/**
 * Tiptap editor of a shared note with simulated co-editors: their carets
 * (and one selection) move every ~2 s, as Yjs awareness would show them.
 */
export function NoteEditor({
    initial,
    editable,
    collaborators,
    onChange,
    onReady,
    onFocusChange,
    className,
}: Props) {
    const callbacks = useRef({ onChange, onFocusChange });
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        callbacks.current = { onChange, onFocusChange };
    });

    const editor = useEditor({
        immediatelyRender: true,
        shouldRerenderOnTransaction: false,
        editable,
        content: initial ?? '',
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: {
                    openOnClick: false,
                    autolink: true,
                    protocols: ['http', 'https', 'mailto'],
                    isAllowedUri: (url) => /^(https?:|mailto:)/i.test(url),
                    HTMLAttributes: {
                        rel: 'noopener noreferrer nofollow',
                        target: '_blank',
                    },
                },
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({
                placeholder: 'Tulis isi catatan…',
            }),
            CollabCursors,
        ],
        editorProps: {
            attributes: {
                'aria-label': 'Isi catatan',
                'aria-multiline': 'true',
                role: 'textbox',
                class: 'rich-text min-h-[50svh] focus:outline-none',
            },
        },
        onUpdate: ({ editor: current }) =>
            callbacks.current.onChange(
                current.isEmpty ? null : (current.getJSON() as RichDoc),
            ),
        onFocus: () => callbacks.current.onFocusChange?.(true),
        onBlur: () => callbacks.current.onFocusChange?.(false),
    });

    useEffect(() => {
        onReady(editor);

        return () => onReady(null);
    }, [editor, onReady]);

    useEffect(() => {
        editor.setEditable(editable);
    }, [editor, editable]);

    // Simulated awareness: move collaborators' carets on a timer. With
    // reduced motion they are placed once and stay still.
    const ids = collaborators.map((person) => person.id).join();

    useEffect(() => {
        if (collaborators.length === 0) {
            return;
        }

        let tick = 0;
        const place = () => {
            if (editor.isDestroyed || !editor.isInitialized) {
                return;
            }

            const blocks = textBlocks(editor.state.doc).filter(
                ([start, end]) => end > start,
            );
            const cursors: RemoteCursor[] = collaborators
                .map((person, seat) => {
                    const head = cursorAt(blocks, tick, seat);

                    if (head === null) {
                        return null;
                    }

                    // The second person selects a few characters.
                    const anchor = seat === 1 ? Math.max(1, head - 9) : head;

                    return {
                        id: person.id,
                        name: person.name,
                        seat,
                        head,
                        anchor,
                    };
                })
                .filter((cursor): cursor is RemoteCursor => cursor !== null);

            editor.view.dispatch(
                editor.state.tr
                    .setMeta(collabCursorsKey, cursors)
                    .setMeta('addToHistory', false),
            );
            tick += 1;
        };

        place();
        // The view mounts after the first render; place them as soon as it does.
        editor.on('create', place);
        const first = window.setTimeout(place, 80);

        const timer = reducedMotion
            ? undefined
            : window.setInterval(place, 2200);

        return () => {
            editor.off('create', place);
            window.clearTimeout(first);
            window.clearInterval(timer);
        };
        // collaborators is derived from ids.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, ids, reducedMotion]);

    return (
        <EditorContent
            editor={editor}
            className={cn(
                'text-[17px] leading-7 text-text',
                NOTE_PROSE,
                className,
            )}
        />
    );
}

type ToolbarItem = {
    label: string;
    icon: LucideIcon;
    active?: (editor: Editor) => boolean;
    run: (editor: Editor) => void;
};

const ITEMS: ToolbarItem[] = [
    {
        label: 'Judul',
        icon: Heading2,
        active: (editor) => editor.isActive('heading', { level: 2 }),
        run: (editor) =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
        label: 'Subjudul',
        icon: Heading3,
        active: (editor) => editor.isActive('heading', { level: 3 }),
        run: (editor) =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
        label: 'Tebal',
        icon: Bold,
        active: (editor) => editor.isActive('bold'),
        run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
        label: 'Miring',
        icon: Italic,
        active: (editor) => editor.isActive('italic'),
        run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
    {
        label: 'Daftar berpoin',
        icon: List,
        active: (editor) => editor.isActive('bulletList'),
        run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
        label: 'Daftar bernomor',
        icon: ListOrdered,
        active: (editor) => editor.isActive('orderedList'),
        run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
        label: 'Checklist',
        icon: ListChecks,
        active: (editor) => editor.isActive('taskList'),
        run: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
        label: 'Kutipan',
        icon: Quote,
        active: (editor) => editor.isActive('blockquote'),
        run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
        label: 'Blok kode',
        icon: Code,
        active: (editor) => editor.isActive('codeBlock'),
        run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
];

/** Compact formatting toolbar (desktop header row / phone bar above the keyboard). */
export function EditorToolbar({
    editor,
    mobile = false,
    className,
}: {
    editor: Editor;
    mobile?: boolean;
    className?: string;
}) {
    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            // The view may not be mounted yet (or already torn down).
            if (!current || current.isDestroyed || !current.isInitialized) {
                return ITEMS.map(() => false);
            }

            return ITEMS.map((item) => item.active?.(current) ?? false);
        },
    });
    const history = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            if (!current || current.isDestroyed || !current.isInitialized) {
                return { undo: false, redo: false };
            }

            return { undo: current.can().undo(), redo: current.can().redo() };
        },
    });
    const button = cn(
        'flex shrink-0 items-center justify-center rounded-[10px] text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text disabled:opacity-40 aria-pressed:bg-link-soft aria-pressed:text-link',
        mobile ? 'size-11' : 'size-9',
        focusRing,
    );

    return (
        <div
            role="toolbar"
            aria-label="Format teks"
            className={cn(
                'flex [scrollbar-width:none] items-center gap-0.5 overflow-x-auto',
                className,
            )}
        >
            <button
                type="button"
                className={button}
                aria-label="Urungkan"
                disabled={!history.undo}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().undo().run()}
            >
                <Undo2 className="size-[18px]" aria-hidden />
            </button>
            <button
                type="button"
                className={button}
                aria-label="Ulangi"
                disabled={!history.redo}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().redo().run()}
            >
                <Redo2 className="size-[18px]" aria-hidden />
            </button>
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-divider" />
            {ITEMS.map((item, index) => (
                <button
                    key={item.label}
                    type="button"
                    className={button}
                    aria-label={item.label}
                    title={item.label}
                    aria-pressed={active[index]}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => item.run(editor)}
                >
                    <item.icon className="size-[18px]" aria-hidden />
                </button>
            ))}
        </div>
    );
}
