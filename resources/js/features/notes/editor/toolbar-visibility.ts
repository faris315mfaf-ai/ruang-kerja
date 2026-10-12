import type { Editor } from '@tiptap/react';
import { type RefObject, useEffect, useRef, useState } from 'react';

/** Hide the formatting bar this long after the last keystroke / caret move. */
export const TOOLBAR_IDLE_MS = 1800;

/**
 * Minimalist note editor (keputusan pemilik 9 Okt 2026): the formatting bar
 * only shows while the user is actually working on the text — a non-empty
 * selection keeps it, plain focus or typing shows it for the idle window —
 * and it hides again on blur (keyboard closed) or once the user goes idle.
 * Focus inside the bar itself (Tab into it, an open colour menu) pins it.
 */
export function shouldShowToolbar(
    /** Timestamp of the last keystroke/caret move/focus, null = never. */
    lastInteraction: number | null,
    hasSelection: boolean,
    focused: boolean,
    now: number,
    idleMs = TOOLBAR_IDLE_MS,
    /** Focus is inside the bar or one of its open menus. */
    pinned = false,
): boolean {
    if (pinned) {
        return true;
    }

    if (!focused) {
        return false;
    }

    if (hasSelection) {
        return true;
    }

    return lastInteraction !== null && now - lastInteraction < idleMs;
}

/**
 * Is this focus target part of the formatting bar: inside it, or inside a
 * menu (Radix portal content) opened from one of its buttons — followed
 * through `aria-labelledby` to the trigger, nested menus included.
 */
export function belongsToToolbar(
    target: EventTarget | null,
    toolbar: HTMLElement | null,
    depth = 0,
): boolean {
    if (!toolbar || !(target instanceof Element) || depth > 4) {
        return false;
    }

    if (toolbar.contains(target)) {
        return true;
    }

    const menu = target.closest('[role="menu"], [role="listbox"]');
    const owner = menu?.getAttribute('aria-labelledby');
    const trigger = owner ? target.ownerDocument.getElementById(owner) : null;

    return trigger !== null && belongsToToolbar(trigger, toolbar, depth + 1);
}

type Activity = {
    hasSelection: boolean;
    focused: boolean;
    pinned: boolean;
    last: number | null;
};

/**
 * Tiptap events (`focus`, `blur`, `selectionUpdate`, `update`) → one boolean
 * for the auto-hiding formatting bar. Attaches to the editor instance the
 * session already owns, so `note-editor.tsx` stays untouched.
 */
export function useToolbarVisibility(
    editor: Editor | null,
    /** The bar's wrapper: focus inside it (or its menus) keeps it shown. */
    toolbar?: RefObject<HTMLElement | null>,
): boolean {
    const [visible, setVisible] = useState(false);
    const activity = useRef<Activity>({
        hasSelection: false,
        focused: false,
        pinned: false,
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
                TOOLBAR_IDLE_MS,
                activity.current.pinned,
            );
            setVisible(next);

            // Re-check when the idle window expires (a selection keeps the
            // bar until it collapses or the editor blurs, so no timer then).
            window.clearTimeout(timer.current);

            if (
                next &&
                !activity.current.hasSelection &&
                !activity.current.pinned
            ) {
                timer.current = window.setTimeout(
                    () => evaluate(false),
                    TOOLBAR_IDLE_MS,
                );
            }
        };
        const onFocus = () => {
            activity.current.focused = true;
            activity.current.pinned = false;
            evaluate(true);
        };
        const onBlur = ({ event }: { event: FocusEvent }) => {
            activity.current.focused = false;
            // Tab into the bar / a colour menu opening: not a real blur.
            activity.current.pinned = belongsToToolbar(
                event.relatedTarget,
                toolbar?.current ?? null,
            );
            evaluate(false);
        };
        // While pinned, follow focus moving around the bar and its menus.
        const onFocusIn = (event: FocusEvent) => {
            if (activity.current.focused) {
                return;
            }

            const pinned = belongsToToolbar(
                event.target,
                toolbar?.current ?? null,
            );

            if (pinned !== activity.current.pinned) {
                activity.current.pinned = pinned;
                evaluate(false);
            }
        };
        const onFocusOut = (event: FocusEvent) => {
            if (
                !activity.current.pinned ||
                belongsToToolbar(event.relatedTarget, toolbar?.current ?? null)
            ) {
                return;
            }

            activity.current.pinned = false;
            evaluate(false);
        };
        const onSelection = () => evaluate(true);
        const onUpdate = () => evaluate(true);

        editor.on('focus', onFocus);
        editor.on('blur', onBlur);
        editor.on('selectionUpdate', onSelection);
        editor.on('update', onUpdate);
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);

        return () => {
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            editor.off('focus', onFocus);
            editor.off('blur', onBlur);
            editor.off('selectionUpdate', onSelection);
            editor.off('update', onUpdate);
            window.clearTimeout(timer.current);
        };
        // The ref object is stable.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    return visible;
}
