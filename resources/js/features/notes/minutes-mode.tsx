import { router } from '@inertiajs/react';
import { CircleStop, NotebookPen } from 'lucide-react';
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

/** Ribbon above the editor while note-taking mode is on. */
export function MinutesModeBar({
    mode,
    mobile = false,
    className,
}: {
    mode: MinutesMode;
    mobile?: boolean;
    className?: string;
}) {
    if (!mode.active) {
        return null;
    }

    return (
        <div
            role="status"
            className={cn(
                'flex items-center gap-3 rounded-[16px] border border-link/25 bg-link-soft px-4 py-2.5',
                className,
            )}
        >
            {!mobile && (
                <NotebookPen
                    aria-hidden
                    className="size-5 shrink-0 text-link"
                />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-[15px] font-bold text-link">
                    Mode catat aktif
                </p>
                {!mobile && (
                    <p className="truncate text-[14px] text-text-muted">
                        Pindah ke modul lain kapan saja; pil &ldquo;Kembali ke
                        notulensi&rdquo; membawa Anda ke sini.
                    </p>
                )}
            </div>
            <Button
                variant="outline"
                size={mobile ? 'default' : 'sm'}
                className="shrink-0"
                onClick={mode.askFinish}
            >
                <CircleStop aria-hidden />
                Selesai mencatat
            </Button>
            <FinishDialog mode={mode} mobile={mobile} />
        </div>
    );
}

function FinishDialog({
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

/** "Mode catat" button (start note-taking on this document). */
export function StartModeButton({
    mode,
    className,
    size,
}: {
    mode: MinutesMode;
    className?: string;
    size?: 'default' | 'lg';
}) {
    if (!mode.canStart) {
        return null;
    }

    return (
        <Button
            variant="tonal"
            size={size}
            className={className}
            onClick={mode.start}
        >
            <NotebookPen aria-hidden />
            Mode catat
        </Button>
    );
}
