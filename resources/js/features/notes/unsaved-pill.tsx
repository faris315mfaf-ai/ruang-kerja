import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, Check, CloudCog, CloudOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { Spinner } from '@/components/ui/spinner';
import { cn, focusRing } from '@/lib/utils';
import {
    flushUnsavedChanges,
    settleUnsavedChanges,
    useUnsavedNotes,
    type UnsavedState,
} from './unsaved-store';
import type { NoteShowProps } from './types';

/** Everything the pill needs to decide what it looks like. */
export type UnsavedPillInput = {
    /** Stuck changes handed over when the editor page was left. */
    unsaved: UnsavedState | null;
    /** The stuck note is open again — its own status UI covers it. */
    onNote: boolean;
    /** Catatan feature flag. */
    notesEnabled: boolean;
};

export type UnsavedPillView = {
    tone: 'warning' | 'danger' | 'success';
    label: string;
    /** Primary action; null once everything is saved. */
    action: { kind: 'save' | 'reload'; label: string } | null;
};

/**
 * View state of the "Catatan belum tersimpan" pill (keputusan pemilik
 * 9 Okt 2026): null = hidden. Pure, so the mapping is unit-tested.
 */
export function unsavedPillState({
    unsaved,
    onNote,
    notesEnabled,
}: UnsavedPillInput): UnsavedPillView | null {
    if (!notesEnabled || unsaved === null || onNote) {
        return null;
    }

    switch (unsaved.phase) {
        case 'saved':
            return { tone: 'success', label: 'Tersimpan ✓', action: null };
        case 'conflict':
            return {
                tone: 'danger',
                label: 'Catatan diubah orang lain',
                action: { kind: 'reload', label: 'Muat ulang' },
            };
        case 'offline':
            return {
                tone: 'warning',
                label: 'Catatan belum tersimpan. Periksa koneksi.',
                action: { kind: 'save', label: 'Coba lagi' },
            };
        default:
            return {
                tone: 'warning',
                label: 'Catatan belum tersimpan',
                action: { kind: 'save', label: 'Simpan' },
            };
    }
}

/** Exit animation length (duration-180). */
const EXIT_MS = 180;

/**
 * "Catatan belum tersimpan" (keputusan pemilik 9 Okt 2026): floating pill
 * top-right on every page while the editor page was left with unflushed
 * changes. The save keeps running in the background; "Simpan" flushes now,
 * the body taps back to the note (after the running save settles, so the
 * page opens with the saved content). Auto-save failures (offline/conflict)
 * switch the label and the action.
 */
export function UnsavedNotePill() {
    const page = usePage<{ note?: NoteShowProps }>();
    const { features } = page.props;
    const breakpoint = useBreakpoint();
    const openNoteId =
        page.component === 'notes/show'
            ? page.props.note?.current.id
            : undefined;
    // One pill: the most recent stuck note other than the one open (its
    // own status UI covers it); the rest are counted.
    const others = useUnsavedNotes().filter(
        (entry) => entry.noteId !== openNoteId,
    );
    const unsaved = others.at(-1) ?? null;
    const more = Math.max(0, others.length - 1);
    const onNote = false;
    const view = unsavedPillState({
        unsaved,
        onNote,
        notesEnabled: features?.notes === true,
    });
    const shown = view !== null;

    // Keep the last state on screen while the exit animation runs.
    const [rendered, setRendered] = useState<{
        unsaved: UnsavedState;
        view: UnsavedPillView;
        more: number;
    } | null>(shown && unsaved && view ? { unsaved, view, more } : null);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (shown && unsaved && view) {
            setRendered({ unsaved, view, more });
            setClosing(false);

            return;
        }

        setClosing(true);
        const timer = window.setTimeout(() => {
            setRendered(null);
            setClosing(false);
        }, EXIT_MS);

        return () => window.clearTimeout(timer);
    }, [shown, unsaved, view, more]);

    if (!rendered || breakpoint === null) {
        return null;
    }

    const { unsaved: stuck, view: pill, more: extra } = rendered;
    const busy = stuck.phase === 'saving';
    const title = stuck.title || 'Tanpa judul';

    // Body tap: let the running save finish, then open the note with the
    // saved content (a conflict reloads the same way).
    const openNote = () => {
        void settleUnsavedChanges(stuck.noteId).then(() => {
            router.visit(`/catatan/${stuck.noteId}`);
        });
    };

    return (
        <div
            className={cn(
                'pointer-events-none fixed z-40 flex justify-end',
                breakpoint === 'mobile'
                    ? 'top-[calc(env(safe-area-inset-top)+var(--app-bar-height)+8px)] right-4 left-4'
                    : 'top-[calc(var(--menu-bar-height)+12px)] right-6',
            )}
        >
            <div
                role="status"
                data-state={closing ? 'closed' : 'open'}
                className={cn(
                    'glass-strong pointer-events-auto flex min-w-0 items-center gap-1 rounded-full pr-1.5 pl-1.5 shadow-float',
                    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2',
                    'animation-duration-180 motion-reduce:animate-none',
                )}
            >
                <button
                    type="button"
                    onClick={openNote}
                    aria-label={`Kembali ke catatan ${title}`}
                    className={cn(
                        'flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-1 pl-3 text-left transition-transform duration-120 ease-brand active:scale-[0.98]',
                        focusRing,
                    )}
                >
                    {pill.tone === 'success' ? (
                        <Check
                            aria-hidden
                            className="size-4 shrink-0 text-success"
                        />
                    ) : pill.tone === 'danger' ? (
                        <AlertTriangle
                            aria-hidden
                            className="size-4 shrink-0 text-warning"
                        />
                    ) : stuck.phase === 'offline' ? (
                        <CloudOff
                            aria-hidden
                            className="size-4 shrink-0 text-text-muted"
                        />
                    ) : (
                        <CloudCog
                            aria-hidden
                            className="size-4 shrink-0 text-text-muted"
                        />
                    )}
                    <span className="flex min-w-0 flex-col leading-tight">
                        <span
                            className={cn(
                                'text-[13px] font-bold',
                                pill.tone === 'success'
                                    ? 'text-success'
                                    : 'text-text',
                            )}
                        >
                            {pill.label}
                        </span>
                        <span className="max-w-[220px] truncate text-[12px] font-semibold text-text-muted">
                            {title}
                            {extra > 0 && ` · +${extra} catatan lain`}
                        </span>
                    </span>
                </button>
                {pill.action && (
                    <button
                        type="button"
                        onClick={
                            pill.action.kind === 'save'
                                ? () => void flushUnsavedChanges(stuck.noteId)
                                : openNote
                        }
                        disabled={busy}
                        className={cn(
                            'flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-link-soft px-3 text-[13px] font-bold text-link transition-opacity duration-120 ease-brand hover:opacity-80 disabled:opacity-60',
                            focusRing,
                        )}
                    >
                        {busy && <Spinner aria-hidden className="size-3.5" />}
                        {pill.action.label}
                    </button>
                )}
            </div>
        </div>
    );
}
