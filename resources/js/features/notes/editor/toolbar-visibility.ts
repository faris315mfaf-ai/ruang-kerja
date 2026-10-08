import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

/** Hide the formatting bar this long after the last keystroke / caret move. */
export const TOOLBAR_IDLE_MS = 1800;

/**
 * Minimalist note editor (keputusan pemilik 9 Okt 2026): the formatting bar
 * only shows while the user is actually working on the text — a non-empty
 * selection keeps it, plain focus or typing shows it for the idle window —
 * and it hides again on blur (keyboard closed) or once the user goes idle.
 */
export function shouldShowToolbar(
    /** Timestamp of the last keystroke/caret move/focus, null = never. */
    lastInteraction: number | null,
    hasSelection: boolean,
    focused: boolean,
    now: number,
    idleMs = TOOLBAR_IDLE_MS,
): boolean {
    if (!focused) {
        return false;
    }

    if (hasSelection) {
        return true;
    }

    return lastInteraction !== null && now - lastInteraction < idleMs;
}

type Activity = {
    hasSelection: boolean;
    focused: boolean;
    last: number | null;
};

/**
 * Tiptap events (`focus`, `blur`, `selectionUpdate`, `update`) → one boolean
 * for the auto-hiding formatting bar. Attaches to the editor instance the
 * session already owns, so `note-editor.tsx` stays untouched.
 */
export function useToolbarVisibility(editor: Editor | null): boolean {
    const [visible, setVisible] = useState(false);
    const activity = useRef<Activity>({
        hasSelection: false,
        focused: false,
        last: null,
    });
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!editor) {
            setVisible(false);

            return;
        }

        const evaluate = (interacted: boolean) => {
            if (editor.isDestroyed) {
                return;
            }

            const now = Date.now();

            if (interacted) {
                activity.current.last = now;
            }

            activity.current.hasSelection = !editor.state.selection.empty;
            const next = shouldShowToolbar(
                activity.current.last,
                activity.current.hasSelection,
                activity.current.focused,
                now,
            );
            setVisible(next);

            // Re-check when the idle window expires (a selection keeps the
            // bar until it collapses or the editor blurs, so no timer then).
            window.clearTimeout(timer.current);

            if (next && !activity.current.hasSelection) {
                timer.current = window.setTimeout(
                    () => evaluate(false),
                    TOOLBAR_IDLE_MS,
                );
            }
        };
        const onFocus = () => {
            activity.current.focused = true;
            evaluate(true);
        };
        const onBlur = () => {
            activity.current.focused = false;
            evaluate(false);
        };
        const onSelection = () => evaluate(true);
        const onUpdate = () => evaluate(true);

        editor.on('focus', onFocus);
        editor.on('blur', onBlur);
        editor.on('selectionUpdate', onSelection);
        editor.on('update', onUpdate);

        return () => {
            editor.off('focus', onFocus);
            editor.off('blur', onBlur);
            editor.off('selectionUpdate', onSelection);
            editor.off('update', onUpdate);
            window.clearTimeout(timer.current);
        };
    }, [editor]);

    return visible;
}
