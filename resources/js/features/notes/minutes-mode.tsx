import { router } from '@inertiajs/react';
import { NotebookPen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { documentRoot } from './lib';
import {
    endMinutesSession,
    startMinutesSession,
    updateMinutesSession,
    useMinutesSession,
} from './minutes-session';
import type { NoteSession } from './use-note-session';

/** `?mode=catat` (from "Mulai notulensi") starts note-taking mode. */
export const MODE_PARAM = 'mode';
export const MODE_VALUE = 'catat';

/**
 * Note-taking mode of the open document (keputusan pemilik 6 Okt 2026):
 * active while the running session belongs to this document (any of its
 * tabs). Starts from `?mode=catat` or the "Mode catat" button; ends only
 * with "Selesai mencatat" (after a forced save).
 */
export function useMinutesMode(session: NoteSession) {
    const { props, note } = session;
    const root = documentRoot(props.notes, note.id) ?? note;
    const rootTitle = root.id === note.id ? session.title : root.title;
    const running = useMinutesSession(props.viewer_id);
    const active = running?.rootId === root.id;
    const [confirming, setConfirming] = useState(false);
    const [finishing, setFinishing] = useState(false);

    // ?mode=catat → start, then drop the parameter (a reload after
    // "Selesai mencatat" must not start the mode again).
    useEffect(() => {
        const url = new URL(window.location.href);

        if (url.searchParams.get(MODE_PARAM) !== MODE_VALUE) {
            return;
        }

        if (note.can_edit) {
            startMinutesSession({
                userId: props.viewer_id,
                noteId: note.id,
                rootId: root.id,
                title: rootTitle,
            });
        }

        url.searchParams.delete(MODE_PARAM);
        router.replace({
            url: `${url.pathname}${url.search}${url.hash}`,
            preserveScroll: true,
            preserveState: true,
        });
        // Once per opened note.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [note.id]);

    // The pill returns to the open tab with the current title.
    useEffect(() => {
        if (active) {
            updateMinutesSession({ noteId: note.id, title: rootTitle });
        }
    }, [active, note.id, rootTitle]);

    const start = () => {
        startMinutesSession({
            userId: props.viewer_id,
            noteId: note.id,
            rootId: root.id,
            title: rootTitle,
        });
        toast.success(
            'Mode catat aktif. Pindah modul kapan saja; kembali lewat pil "Kembali ke notulensi".',
        );
    };

    const finish = async () => {
        setFinishing(true);

        try {
            const saved = await session.flushNow();

            if (!saved) {
                toast.error(
                    'Sebagian isi belum tersimpan. Periksa koneksi, lalu coba lagi.',
                );

                return;
            }

            endMinutesSession();
            setConfirming(false);
            toast.success('Notulensi selesai dan tersimpan di Catatan.');
        } finally {
            setFinishing(false);
        }
    };

    return {
        active,
        /** Another document is being noted (this one shows no start button). */
        busyElsewhere: running !== null && !active,
        canStart: note.can_edit && running === null,
        rootId: root.id,
        start,
        askFinish: () => setConfirming(true),
        confirming,
        setConfirming,
        finishing,
        finish,
    };
}

export type MinutesMode = ReturnType<typeof useMinutesMode>;

/**
 * Icon-only "Mode catat" toggle for the slim note headers: pressed (tonal)
 * while the mode runs on this document, tap to start or to confirm finishing.
 * The confirmation dialog/sheet comes along with the button.
 */
export function MinutesModeIconButton({
    mode,
    mobile = false,
    className,
    buttonClassName,
}: {
    mode: MinutesMode;
    /** Phones render the confirm step as a bottom sheet. */
    mobile?: boolean;
    className?: string;
    buttonClassName?: string;
}) {
    const enabled = mode.active || mode.canStart;

    return (
        <div className={cn('flex items-center', className)}>
            <button
                type="button"
                aria-pressed={mode.active}
                aria-label={
                    mode.active
                        ? 'Mode catat aktif, selesai mencatat'
                        : 'Mode catat'
                }
                title={mode.active ? 'Selesai mencatat' : 'Mulai mode catat'}
                disabled={!enabled}
                onClick={() => (mode.active ? mode.askFinish() : mode.start())}
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-120 ease-brand disabled:opacity-40',
                    mode.active
                        ? 'bg-link-soft text-link'
                        : 'text-text hover:bg-surface-2 hover:text-text',
                    buttonClassName,
                )}
            >
                <NotebookPen className="size-5" aria-hidden />
            </button>
            <FinishDialog mode={mode} mobile={mobile} />
        </div>
    );
}

/** "Selesai mencatat?" confirmation: bottom sheet on phones, dialog on desktop. */
export function FinishDialog({
    mode,
    mobile,
}: {
    mode: MinutesMode;
    mobile: boolean;
}) {
    const title = 'Selesai mencatat?';
    const description =
        'Isi disimpan sekarang. Notulensi tetap ada di Catatan › Pribadi dan pil "Kembali ke notulensi" ditutup.';
    const confirm = (
        <Button
            onClick={() => void mode.finish()}
            disabled={mode.finishing}
            size={mobile ? 'lg' : 'default'}
            className={mobile ? 'w-full' : undefined}
        >
            {mode.finishing && <Spinner />}
            Selesai mencatat
        </Button>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={mode.confirming}
                onOpenChange={mode.setConfirming}
                title={title}
                description={description}
                footer={confirm}
            >
                <span className="sr-only">{description}</span>
            </BottomSheet>
        );
    }

    return (
        <Dialog open={mode.confirming} onOpenChange={mode.setConfirming}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="quiet"
                        onClick={() => mode.setConfirming(false)}
                    >
                        Lanjut mencatat
                    </Button>
                    {confirm}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
