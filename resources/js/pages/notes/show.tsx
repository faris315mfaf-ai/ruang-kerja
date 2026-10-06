import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreviewState } from '@/features/chat/preview-state';
import { NoteDesktop } from '@/features/notes/note.desktop';
import { NoteAppBarActions, NoteMobile } from '@/features/notes/note.mobile';
import { getNotesState, useNotesState } from '@/features/notes/store';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = { noteId: string };

/** /catatan/{note} — shared note editor (Fase 2 preview, F2-2). */
export default function NotesShowPage({ noteId }: Props) {
    const breakpoint = useBreakpoint();
    const state = useNotesState();
    const preview = usePreviewState();
    const note = state.notes.find((item) => item.id === noteId);

    return (
        <>
            <Head title={`${note?.title ?? 'Catatan'} · Catatan`} />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <NoteMobile
                    key={noteId}
                    state={state}
                    noteId={noteId}
                    preview={preview}
                />
            ) : (
                <NoteDesktop
                    key={noteId}
                    state={state}
                    noteId={noteId}
                    preview={preview}
                />
            )}
        </>
    );
}

function titleFor(noteId: string): string {
    return (
        getNotesState().notes.find((item) => item.id === noteId)?.title ??
        'Catatan'
    );
}

NotesShowPage.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Catatan', href: '/catatan' },
        { title: titleFor(props.noteId), href: `/catatan/${props.noteId}` },
    ],
    title: titleFor(props.noteId),
    back: '/catatan',
    width: 'wide',
    appBarActions: <NoteAppBarActions />,
});
