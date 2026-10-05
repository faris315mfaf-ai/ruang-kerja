import Mention from '@tiptap/extension-mention';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { suggestionOptions } from './suggestions';
import type { RichDoc } from './types';

export type RichTextEditorApi = {
    focus: () => void;
    clear: () => void;
    isEmpty: () => boolean;
    getJSON: () => RichDoc | null;
    setContent: (doc: RichDoc | null) => void;
    /** Starts an "@" mention at the caret (toolbar button / mobile). */
    startMention: () => void;
    toggleBold: () => void;
    toggleBulletList: () => void;
    toggleTaskList: () => void;
};

export type RichTextEditorProps = {
    value: RichDoc | null;
    workspaceKey: string;
    placeholder: string;
    ariaLabel: string;
    onChange?: (doc: RichDoc | null) => void;
    /** Cmd/Ctrl+Enter. */
    onSubmit?: () => void;
    onBlur?: () => void;
    onReady?: (api: RichTextEditorApi | null) => void;
    autoFocus?: boolean;
    editable?: boolean;
    className?: string;
};

/** "#KEY-n" node: same as a mention, rendered as a mono task id. */
const TaskReference = Mention.extend({ name: 'taskReference' });

function apiFor(editor: Editor): RichTextEditorApi {
    return {
        focus: () => editor.commands.focus('end'),
        clear: () => editor.commands.clearContent(true),
        isEmpty: () => editor.isEmpty,
        getJSON: () => (editor.isEmpty ? null : (editor.getJSON() as RichDoc)),
        setContent: (doc) =>
            editor.commands.setContent(doc ?? '', { emitUpdate: false }),
        startMention: () =>
            editor
                .chain()
                .focus()
                .insertContent(
                    editor.state.selection.$from.nodeBefore?.text?.endsWith(' ')
                        ? '@'
                        : ' @',
                )
                .run(),
        toggleBold: () => editor.chain().focus().toggleBold().run(),
        toggleBulletList: () => editor.chain().focus().toggleBulletList().run(),
        toggleTaskList: () => editor.chain().focus().toggleTaskList().run(),
    };
}

/**
 * Tiptap editor for task descriptions and comments (docs/PROMPTS.md
 * Sprint 6): headings, lists, checklists, code, links, "@" mentions of
 * people who can see the workspace and "#KEY-n" task references. The
 * server re-sanitizes every document (App\Domain\Tasks\Services\RichText).
 * Loaded lazily (React.lazy) so boards without an open task stay light.
 */
export default function RichTextEditor({
    value,
    workspaceKey,
    placeholder,
    ariaLabel,
    onChange,
    onSubmit,
    onBlur,
    onReady,
    autoFocus = false,
    editable = true,
    className,
}: RichTextEditorProps) {
    const callbacks = useRef({ onChange, onSubmit, onBlur });

    useEffect(() => {
        callbacks.current = { onChange, onSubmit, onBlur };
    });

    const editor = useEditor({
        immediatelyRender: true,
        shouldRerenderOnTransaction: false,
        editable,
        autofocus: autoFocus ? 'end' : false,
        content: value ?? '',
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
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
            Placeholder.configure({ placeholder }),
            Mention.configure({
                HTMLAttributes: { class: 'rt-mention' },
                renderText: ({ node }) => `@${String(node.attrs.label ?? '')}`,
                renderHTML: ({ node, options }) => [
                    'span',
                    { ...options.HTMLAttributes, 'data-id': node.attrs.id },
                    `@${String(node.attrs.label ?? '')}`,
                ],
                suggestion: suggestionOptions(workspaceKey, 'person'),
            }),
            TaskReference.configure({
                HTMLAttributes: { class: 'rt-task-ref' },
                renderText: ({ node }) => String(node.attrs.label ?? ''),
                renderHTML: ({ node, options }) => [
                    'span',
                    { ...options.HTMLAttributes, 'data-id': node.attrs.id },
                    String(node.attrs.label ?? ''),
                ],
                suggestion: suggestionOptions(workspaceKey, 'task'),
            }),
        ],
        editorProps: {
            attributes: {
                'aria-label': ariaLabel,
                'aria-multiline': 'true',
                role: 'textbox',
                class: 'rich-text min-h-[inherit] focus:outline-none',
            },
            handleKeyDown: (_view, event) => {
                if (
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey) &&
                    callbacks.current.onSubmit
                ) {
                    event.preventDefault();
                    callbacks.current.onSubmit();

                    return true;
                }

                return false;
            },
        },
        onUpdate: ({ editor: current }) =>
            callbacks.current.onChange?.(
                current.isEmpty ? null : (current.getJSON() as RichDoc),
            ),
        onBlur: () => callbacks.current.onBlur?.(),
    });

    useEffect(() => {
        onReady?.(editor ? apiFor(editor) : null);

        return () => onReady?.(null);
    }, [editor, onReady]);

    useEffect(() => {
        editor?.setEditable(editable);
    }, [editor, editable]);

    return (
        <EditorContent
            editor={editor}
            className={cn('text-[15px] leading-relaxed text-text', className)}
        />
    );
}
