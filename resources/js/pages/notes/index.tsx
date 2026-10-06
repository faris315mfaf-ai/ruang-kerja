import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { NotesIndex } from '@/features/notes/notes-index';
import type { NotesIndexProps } from '@/features/notes/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = { notes: NotesIndexProps };

/**
 * /catatan — Catatan bersama (F2-2): wiki, SOP and light minutes per
 * workspace, in folders, edited together (collab server, collab/).
 */
export default function NotesIndexPage({ notes }: Props) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Catatan" />
            {breakpoint === null ? (
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
