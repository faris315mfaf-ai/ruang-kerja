import type { HocuspocusProvider } from '@hocuspocus/provider';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Mention from '@tiptap/extension-mention';
import { Placeholder } from '@tiptap/extensions';
import type { AnyExtension, Editor } from '@tiptap/react';
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
import type { CSSProperties } from 'react';
import type * as Y from 'yjs';
import { suggestionOptions } from '@/features/tasks/editor/suggestions';
import type { RichDoc } from '@/features/tasks/editor/types';
import { cn, focusRing } from '@/lib/utils';
import {
    caretElement,
    CURSOR_TONES,
    selectionAttributes,
} from './cursor-tones';
import { Highlight, TextColor } from './editor/color-marks';
import {
    ColorMenu,
    TextSizeButton,
    TextSizeControl,
} from './editor/toolbar-extras';
import { toneFor } from './lib';
import { useNoteScale } from './note-scale';

/**
 * Document-sized headings for notes (the shared .rich-text scale is tuned
 * for comments). Sizes are relative (em) so they follow the text size of
 * the editor (A− / A+, --note-scale). Editor: h1–h3; read-only view
 * renders levels as h3–h5.
 */
export const NOTE_PROSE = cn(
    '[&_.ProseMirror_h1]:mt-[1.9em] [&_.ProseMirror_h1]:text-[1.53em] [&_.ProseMirror_h1]:leading-[1.23] [&_.ProseMirror_h1]:font-bold',
    '[&_.ProseMirror_h2]:mt-[1.6em] [&_.ProseMirror_h2]:text-[1.3em] [&_.ProseMirror_h2]:leading-[1.36] [&_.ProseMirror_h2]:font-bold',
    '[&_.ProseMirror_h3]:mt-[1.2em] [&_.ProseMirror_h3]:text-[1.06em] [&_.ProseMirror_h3]:leading-[1.44] [&_.ProseMirror_h3]:font-bold',
);

/** Same scale for RichTextView (heading levels 1/2/3 render as h3/h4/h5). */
export const NOTE_PROSE_VIEW = cn(
    '[&_h3]:mt-8 [&_h3]:text-[26px] [&_h3]:leading-8 [&_h3]:font-bold',
    '[&_h4]:mt-7 [&_h4]:text-[22px] [&_h4]:leading-[30px] [&_h4]:font-bold',
    '[&_h5]:mt-5 [&_h5]:text-[18px] [&_h5]:leading-[26px] [&_h5]:font-bold',
);

export type LiveDocument = {
    doc: Y.Doc;
    provider: HocuspocusProvider;
};

type Props = {
    /**
     * Live: the Yjs document of the collab server (content, history and
     * carets come from it). Null: local mode, `initial` is the content and
     * changes go to `onChange` (save without collaboration).
     */
    live: LiveDocument | null;
    /** Remount (key) to load another note or a restored version. */
    initial: RichDoc | null;
    editable: boolean;
    me: { id: string; name: string };
    /** Workspace key for @mention suggestions (people of the workspace). */
    workspaceKey: string | null;
    onChange?: (doc: RichDoc | null) => void;
    onReady: (editor: Editor | null) => void;
    className?: string;
};

/**
 * Tiptap editor of a shared note. Live: Collaboration (Yjs) + carets of
 * the other editors in their token colour with a name label. Local: plain
 * editor whose changes the session saves with PATCH.
 */
export function NoteEditor({
    live,
    initial,
    editable,
    me,
    workspaceKey,
    onChange,
    onReady,
    className,
}: Props) {
    const callbacks = useRef({ onChange });
    const scale = useNoteScale();

    useEffect(() => {
        callbacks.current = { onChange };
    });

    const extensions: AnyExtension[] = [
        StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            // Yjs keeps its own (per-person) history in live mode.
            ...(live ? { undoRedo: false as const } : {}),
            link: {
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
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
        TextColor,
        Highlight,
        Placeholder.configure({ placeholder: 'Tulis isi catatan…' }),
        Mention.configure({
            HTMLAttributes: { class: 'rt-mention' },
            renderText: ({ node }) => `@${String(node.attrs.label ?? '')}`,
            renderHTML: ({ node, options }) => [
                'span',
                { ...options.HTMLAttributes, 'data-id': node.attrs.id },
                `@${String(node.attrs.label ?? '')}`,
            ],
            ...(workspaceKey
                ? { suggestion: suggestionOptions(workspaceKey, 'person') }
                : {}),
        }),
    ];

    if (live) {
        extensions.push(
            Collaboration.configure({ document: live.doc }),
            CollaborationCaret.configure({
                provider: live.provider,
                user: {
                    id: me.id,
                    name: me.name,
                    tone: toneFor(me.id, CURSOR_TONES.length),
                },
                render: caretElement,
                selectionRender: selectionAttributes,
            }),
        );
    }

    const editor = useEditor({
        immediatelyRender: true,
        shouldRerenderOnTransaction: false,
        editable,
        ...(live ? {} : { content: initial ?? '' }),
        extensions,
        editorProps: {
            attributes: {
                'aria-label': 'Isi catatan',
                'aria-multiline': 'true',
                role: 'textbox',
                class: 'rich-text min-h-[50svh] focus:outline-none',
            },
        },
        onUpdate: ({ editor: current, transaction }) => {
            // Remote Yjs changes are not "my edits".
            if (!live && transaction.docChanged) {
                callbacks.current.onChange?.(
                    current.isEmpty ? null : (current.getJSON() as RichDoc),
                );
            }
        },
    });

    useEffect(() => {
        onReady(editor);

        return () => onReady(null);
    }, [editor, onReady]);

    useEffect(() => {
        editor.setEditable(editable);
    }, [editor, editable]);

    return (
        <EditorContent
            editor={editor}
            // Text size per device (app.css .note-body) × the A−/A+ choice.
            style={{ '--note-scale': scale / 100 } as CSSProperties}
            className={cn('note-body text-text', NOTE_PROSE, className)}
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
    onTextSize,
    className,
}: {
    editor: Editor;
    mobile?: boolean;
    /** Phone: opens "Tampilan teks" (the size control lives in a sheet). */
    onTextSize?: () => void;
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
                // relative: sr-only labels inside stay clipped by the scroller.
                'relative flex [scrollbar-width:none] items-center gap-0.5 overflow-x-auto',
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
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-divider" />
            <ColorMenu
                editor={editor}
                kind="textColor"
                buttonClassName={button}
            />
            <ColorMenu
                editor={editor}
                kind="highlight"
                buttonClassName={button}
            />
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-divider" />
            {mobile ? (
                onTextSize && (
                    <TextSizeButton
                        buttonClassName={button}
                        onClick={onTextSize}
                    />
                )
            ) : (
                <TextSizeControl buttonClassName={button} />
            )}
        </div>
    );
}
