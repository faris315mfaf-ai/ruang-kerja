import { Head } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { visitMinutes } from '@/features/notes/minutes-navigation';
import { useMinutesSession } from '@/features/notes/minutes-session';
import { NotesIndex } from '@/features/notes/notes-index';
import type { NotesIndexProps } from '@/features/notes/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = { notes: NotesIndexProps };

/**
 * /catatan — Catatan bersama (F2-2): wiki, SOP and light minutes per
 * workspace, in folders, edited together (collab server, collab/).
 *
 * While note-taking mode is on (keputusan pemilik 6 Okt 2026), opening the
 * Catatan menu (Dock, Rail, Lainnya) goes straight back to the running
 * minutes; a search (?q=) still shows the list.
 */
export default function NotesIndexPage({ notes }: Props) {
    const breakpoint = useBreakpoint();
    const running = useMinutesSession(notes.viewer_id);
    const redirecting = running !== null && notes.query === '';
    const sent = useRef(false);

    useEffect(() => {
        if (!redirecting || !running || sent.current) {
            return;
        }

        sent.current = true;
        toast.info('Kembali ke notulensi');
        visitMinutes(running, { replace: true });
    }, [redirecting, running]);

    return (
        <>
            <Head title="Catatan" />
            {breakpoint === null || redirecting ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : (
                <NotesIndex props={notes} mobile={breakpoint === 'mobile'} />
            )}
        </>
    );
}

NotesIndexPage.layout = {
    breadcrumbs: [{ title: 'Catatan', href: '/catatan' }],
    title: 'Catatan',
};
