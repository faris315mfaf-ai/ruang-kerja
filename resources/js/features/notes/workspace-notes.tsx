import { FilePlus2, FolderPlus, NotebookPen } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import type { WorkspaceDetail } from '@/features/workspaces/types';
import { NoteTree } from './note-tree';
import { useTreeActions } from './tree-actions';
import type { NoteWorkspace, WorkspaceNotesProps } from './types';

/**
 * Tab "Catatan" of a workspace (/w/{key}/catatan): its folders and notes.
 * In the personal workspace this is the owner's own notebook: "Folder baru"
 * → "Catatan baru" (in the folder) → editor, saved automatically.
 */
export function WorkspaceNotes({
    workspace,
    props,
    mobile,
}: {
    workspace: WorkspaceDetail;
    props: WorkspaceNotesProps;
    mobile: boolean;
}) {
    const target: NoteWorkspace = {
        id: workspace.id,
        key: workspace.key,
        name: workspace.type === 'personal' ? 'Pribadi' : workspace.name,
        color: workspace.color ?? 'teal',
        type: workspace.type,
        can_create: props.can_create,
    };
    const actions = useTreeActions({
        notes: props.notes,
        workspaces: [target],
        mobile,
        backToWorkspace: true,
    });
    const personal = workspace.type === 'personal';
    const create = (kind: 'note' | 'folder') =>
        actions.openNew({ kind, workspaceId: workspace.id, parentId: null });

    return (
        <div className="flex flex-col gap-4">
            {props.can_create && !mobile && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[15px] text-text-muted">
                        {personal
                            ? 'Catatan pribadi hanya terlihat oleh Anda.'
                            : 'Catatan bisa disunting bersama anggota workspace.'}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => create('folder')}
                        >
                            <FolderPlus aria-hidden />
                            Folder baru
                        </Button>
                        <Button onClick={() => create('note')}>
                            <FilePlus2 aria-hidden />
                            Catatan baru
                        </Button>
                    </div>
                </div>
            )}

            {props.notes.length === 0 ? (
                <EmptyState
                    icon={NotebookPen}
                    title="Belum ada catatan"
                    description={
                        props.can_create
                            ? personal
                                ? 'Buat folder untuk mengelompokkan, lalu tulis catatan pertama Anda. Semua tersimpan otomatis.'
                                : 'Tulis SOP, wiki, atau notulen ringan untuk workspace ini.'
                            : 'Belum ada catatan yang bisa Anda buka di workspace ini.'
                    }
                    action={
                        props.can_create ? (
                            <div className="flex flex-wrap justify-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => create('folder')}
                                >
                                    <FolderPlus aria-hidden />
                                    Folder baru
                                </Button>
                                <Button onClick={() => create('note')}>
                                    <FilePlus2 aria-hidden />
                                    Catatan baru
                                </Button>
                            </div>
                        ) : undefined
                    }
                />
            ) : (
                <Panel
                    flush
                    title="Folder & catatan"
                    action={
                        <span className="text-[15px] font-normal text-text-muted tnum">
                            {
                                props.notes.filter(
                                    (note) => note.kind === 'note',
                                ).length
                            }{' '}
                            catatan
                        </span>
                    }
                    className="max-w-4xl"
                    bodyClassName={mobile ? 'px-2' : 'px-4'}
                >
                    <NoteTree
                        notes={actions.rows}
                        people={props.people}
                        mobile={mobile}
                        onAction={
                            props.can_create ? actions.onAction : undefined
                        }
                    />
                </Panel>
            )}

            {mobile && props.can_create && (
                <Fab
                    label="Catatan atau folder baru"
                    onClick={() => create('note')}
                />
            )}
            {actions.dialogs}
        </div>
    );
}
