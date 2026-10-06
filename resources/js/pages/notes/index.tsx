import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreviewState } from '@/features/chat/preview-state';
import { NotesIndex } from '@/features/notes/notes-index';
import { useNotesState } from '@/features/notes/store';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /catatan — Catatan bersama (Fase 2 preview, F2-2): wiki, SOP and light
 * minutes per workspace. Sample data, client-only.
 */
export default function NotesIndexPage() {
    const breakpoint = useBreakpoint();
    const state = useNotesState();
    const preview = usePreviewState();

    return (
        <>
            <Head title="Catatan" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : (
                <NotesIndex
                    state={state}
                    preview={preview}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

NotesIndexPage.layout = {
    breadcrumbs: [{ title: 'Catatan', href: '/catatan' }],
    title: 'Catatan',
};
