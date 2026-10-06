import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import minutesRoutes from '@/routes/notes/minutes';
import { endMinutesSession, readSession, sessionUrl } from './minutes-session';
import type { MinutesSession } from './minutes-session';

const GONE_MESSAGE =
    'Notulensi yang sedang dicatat tidak tersedia lagi (dihapus atau akses dicabut). Mode catat diakhiri.';

/**
 * Back to the open tab of the running minutes. When the note is gone or no
 * longer visible (404/403) the session is cleared with a message instead of
 * an error page.
 */
export function visitMinutes(
    session: MinutesSession,
    options: { replace?: boolean; onGone?: () => void } = {},
): void {
    router.visit(sessionUrl(session), {
        replace: options.replace ?? false,
        onHttpException: (response) => {
            if (response.status === 404 || response.status === 403) {
                endMinutesSession();
                toast.error(GONE_MESSAGE);
                options.onGone?.();

                return false;
            }
        },
    });
}

/** "Mulai notulensi": resume the running minutes, or start new ones. */
export function startOrResumeMinutes(
    userId: string | null | undefined,
    callbacks: { onStart?: () => void; onFinish?: () => void } = {},
): void {
    const running = readSession();

    if (running && userId && running.userId === userId) {
        visitMinutes(running);

        return;
    }

    router.post(
        minutesRoutes.start.url(),
        {},
        {
            onStart: callbacks.onStart,
            onFinish: callbacks.onFinish,
            onError: () => toast.error('Notulensi gagal dibuat. Coba lagi.'),
        },
    );
}
