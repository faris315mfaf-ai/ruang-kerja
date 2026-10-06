import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteDesktop } from '@/features/notes/note.desktop';
import { NoteAppBarActions, NoteMobile } from '@/features/notes/note.mobile';
import type { NoteShowProps, NoteVersion } from '@/features/notes/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { notes as workspaceNotes } from '@/routes/workspaces';

type Props = { note: NoteShowProps; versions?: NoteVersion[] };

/** /catatan/{note} — shared note editor (F2-2). */
export default function NotesShowPage({ note, versions }: Props) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title={`${note.current.title} · Catatan`} />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-96 w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <NoteMobile
                    key={note.current.id}
                    props={note}
                    versions={versions}
                />
            ) : (
                <NoteDesktop
                    key={note.current.id}
                    props={note}
                    versions={versions}
                />
            )}
        </>
    );
}

NotesShowPage.layout = (props: Props) => {
    const workspace = props.note.workspaces.find(
        (item) => item.id === props.note.current.workspace_id,
    );
    const back = props.note.current.workspace_key
        ? workspaceNotes.url(props.note.current.workspace_key)
        : '/catatan';

    return {
        breadcrumbs: [
            { title: 'Catatan', href: '/catatan' },
            ...(workspace ? [{ title: workspace.name, href: back }] : []),
            {
                title: props.note.current.title,
                href: `/catatan/${props.note.current.id}`,
            },
        ],
        title: props.note.current.title,
        back,
        width: 'wide' as const,
        appBarActions: (
            <NoteAppBarActions canShare={props.note.current.can_share} />
        ),
    };
};
