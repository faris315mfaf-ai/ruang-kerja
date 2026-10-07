import type { Editor } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/react';
import { isPaletteColor } from '@/lib/palette';
import type { PaletteColor } from '@/lib/palette';

/**
 * Text colour and highlight ("stabilo") of notes (keputusan pemilik 6 Okt
 * 2026). The attribute is a palette NAME, never a CSS value; the colour
 * itself comes from --tag-* (resources/css/rich-text.css), so it follows
 * light and dark mode. The server keeps these marks for notes only
 * (RichText::sanitize `colors`).
 */

/** Order of the swatches in the toolbar popovers. */
export const TEXT_COLORS: readonly PaletteColor[] = [
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'violet',
    'pink',
    'slate',
    'gray',
];

export const HIGHLIGHT_COLORS: readonly PaletteColor[] = [
    'amber',
    'green',
    'teal',
    'blue',
    'violet',
    'pink',
    'red',
    'orange',
];

const DEFAULT_HIGHLIGHT: PaletteColor = 'amber';

let lastHighlight: PaletteColor = DEFAULT_HIGHLIGHT;

/** Colour reused by Ctrl/⌘ + Shift + H. */
export function rememberHighlight(color: PaletteColor): void {
    lastHighlight = color;
}

export function lastHighlightColor(): PaletteColor {
    return lastHighlight;
}

function colorAttribute() {
    return {
        color: {
            default: null,
            parseHTML: (element: HTMLElement) => {
                const value = element.getAttribute('data-color');

                return isPaletteColor(value) ? value : null;
            },
            renderHTML: (attributes: Record<string, unknown>) =>
                isPaletteColor(attributes.color)
                    ? { 'data-color': attributes.color }
                    : {},
        },
    };
}

/** `<span class="rk-color" data-color="red">` */
export const TextColor = Mark.create({
    name: 'textColor',

    addAttributes() {
        return colorAttribute();
    },

    parseHTML() {
        return [
            {
                tag: 'span.rk-color[data-color]',
                getAttrs: (element) =>
                    isPaletteColor(element.getAttribute('data-color'))
                        ? null
                        : false,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes({ class: 'rk-color' }, HTMLAttributes),
            0,
        ];
    },
});

/** `<mark class="rk-highlight" data-color="amber">` */
export const Highlight = Mark.create({
    name: 'highlight',

    addAttributes() {
        return colorAttribute();
    },

    parseHTML() {
        return [
            {
                tag: 'mark',
                getAttrs: (element) => {
                    const value = element.getAttribute('data-color');

                    // Pasted <mark> without a palette name: default stabilo.
                    return {
                        color: isPaletteColor(value) ? value : lastHighlight,
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'mark',
            mergeAttributes({ class: 'rk-highlight' }, HTMLAttributes),
            0,
        ];
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Shift-h': () => toggleHighlight(this.editor),
        };
    },
});

/** Active palette name of a colour mark at the selection, null when none. */
export function activeColor(
    editor: Editor,
    mark: 'textColor' | 'highlight',
): PaletteColor | null {
    const value: unknown = editor.getAttributes(mark).color;

    return isPaletteColor(value) ? value : null;
}

export function setTextColor(editor: Editor, color: PaletteColor | null): void {
    const chain = editor.chain().focus();

    if (color === null) {
        chain.unsetMark('textColor').run();
    } else {
        chain.setMark('textColor', { color }).run();
    }
}

export function setHighlight(editor: Editor, color: PaletteColor | null): void {
    const chain = editor.chain().focus();

    if (color === null) {
        chain.unsetMark('highlight').run();
    } else {
        rememberHighlight(color);
        chain.setMark('highlight', { color }).run();
    }
}

/** Ctrl/⌘ + Shift + H: last highlight on, or off when already highlighted. */
export function toggleHighlight(editor: Editor): boolean {
    if (editor.isActive('highlight')) {
        return editor.chain().focus().unsetMark('highlight').run();
    }

    return editor
        .chain()
        .focus()
        .setMark('highlight', { color: lastHighlight })
        .run();
}

/** "Hapus warna": both colour marks off. */
export function clearColors(editor: Editor): void {
    editor.chain().focus().unsetMark('textColor').unsetMark('highlight').run();
}
