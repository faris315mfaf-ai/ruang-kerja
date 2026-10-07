/**
 * Token classes per collaborator seat (caret, name label, selection, avatar
 * ring). The seat comes from the person's id (lib.toneFor), so everyone sees
 * the same colour for the same person. No hex: colours are design tokens.
 */
export const CURSOR_TONES = [
    {
        caret: 'border-fill-violet',
        label: 'bg-fill-violet text-on-brand',
        selection: 'bg-fill-violet/20',
        ring: 'ring-fill-violet',
    },
    {
        caret: 'border-accent-blue-strong',
        label: 'bg-accent-blue-strong text-on-brand',
        selection: 'bg-accent-blue/20',
        ring: 'ring-accent-blue-strong',
    },
    {
        caret: 'border-primary',
        label: 'bg-primary text-primary-foreground',
        selection: 'bg-primary/20',
        ring: 'ring-primary',
    },
    {
        caret: 'border-fill-warning',
        label: 'bg-fill-warning text-on-brand',
        selection: 'bg-fill-warning/20',
        ring: 'ring-fill-warning',
    },
] as const;

export type CursorTone = (typeof CURSOR_TONES)[number];

export function cursorTone(seat: number): CursorTone {
    return CURSOR_TONES[Math.abs(seat) % CURSOR_TONES.length];
}

/** Caret element of a remote editor (CollaborationCaret render). */
export function caretElement(user: {
    name?: unknown;
    tone?: unknown;
}): HTMLElement {
    const tone = cursorTone(typeof user.tone === 'number' ? user.tone : 0);
    const caret = document.createElement('span');
    caret.className = `collab-caret pointer-events-none relative -mx-px inline border-l-2 ${tone.caret}`;
    caret.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = `absolute bottom-full left-[-2px] mb-0.5 rounded-xs px-1.5 py-px text-[11px] leading-4 font-bold whitespace-nowrap shadow-card select-none ${tone.label}`;
    label.textContent =
        typeof user.name === 'string' ? (user.name.split(' ')[0] ?? '') : '';
    caret.appendChild(label);

    return caret;
}

/** Selection highlight of a remote editor (CollaborationCaret selectionRender). */
export function selectionAttributes(user: { tone?: unknown }): {
    class: string;
} {
    const tone = cursorTone(typeof user.tone === 'number' ? user.tone : 0);

    return { class: `rounded-[2px] ${tone.selection}` };
}
