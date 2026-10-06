import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/features/tasks/lib/api';
import notesRoutes from '@/routes/notes';
import { notesApi } from './api';
import { parentOptions } from './lib';
import type { NewNoteDefaults } from './new-note-dialog';
import { NewNoteDialog } from './new-note-dialog';
import type { TreeAction } from './note-tree';
import type { Note, NoteWorkspace } from './types';

const ROOT = '__root';

function failure(error: unknown): void {
    toast.error(
        error instanceof ApiError
            ? error.message
            : 'Terjadi kesalahan. Coba lagi sebentar lagi.',
    );
}

/** Small dialog / bottom sheet shell shared by rename, move and delete. */
function ActionShell({
    open,
    onOpenChange,
    title,
    description,
    mobile,
    footer,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    mobile: boolean;
    footer: ReactNode;
    children?: ReactNode;
}) {
    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                description={description}
                footer={footer}
            >
                {children}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                {children}
                <DialogFooter>{footer}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** "Pindahkan": choose the folder (or parent note) a row goes under. */
export function MoveDialog({
    note,
    notes,
    mobile,
    onClose,
    onMoved,
}: {
    note: Note | null;
    notes: Note[];
    mobile: boolean;
    onClose: () => void;
    onMoved: (note: Note, parentId: string | null) => void;
}) {
    const [target, setTarget] = useState(ROOT);
    const [prev, setPrev] = useState<Note | null>(null);
    const [processing, setProcessing] = useState(false);

    if (prev !== note) {
        setPrev(note);
        setTarget(note?.parent_id ?? ROOT);
    }

    const options = note
        ? parentOptions(
              notes.filter((item) => item.workspace_id === note.workspace_id),
              note.kind,
              note.id,
          )
        : [];

    const save = async () => {
        if (!note) {
            return;
        }

        const parentId = target === ROOT ? null : target;
        setProcessing(true);

        try {
            await notesApi.move(note.id, parentId);
            onMoved(note, parentId);
            toast.success(`${note.title} dipindahkan.`);
            onClose();
        } catch (error) {
            failure(error);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <ActionShell
            open={note !== null}
            onOpenChange={(open) => !open && onClose()}
            title="Pindahkan"
            description={note?.title}
            mobile={mobile}
            footer={
                <>
                    {!mobile && (
                        <Button variant="quiet" onClick={onClose}>
                            Batal
                        </Button>
                    )}
                    <Button
                        onClick={() => void save()}
                        disabled={processing}
                        size={mobile ? 'lg' : 'default'}
                        className={mobile ? 'w-full' : undefined}
                    >
                        {processing && <Spinner />}
                        Pindahkan
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="move-note-target">Ke</Label>
                <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger id="move-note-target">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ROOT}>
                            Tingkat atas (tanpa folder)
                        </SelectItem>
                        {options.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                                {option.title}
                                {option.kind === 'folder' ? ' (folder)' : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {note?.kind === 'folder' && (
                    <p className="text-[14px] text-text-muted">
                        Folder hanya bisa berada di tingkat atas atau di dalam
                        folder lain.
                    </p>
                )}
            </div>
        </ActionShell>
    );
}

/** "Ganti nama" of a folder or note from the list. */
export function RenameDialog({
    note,
    mobile,
    onClose,
    onRenamed,
}: {
    note: Note | null;
    mobile: boolean;
    onClose: () => void;
    onRenamed: (note: Note, title: string) => void;
}) {
    const [title, setTitle] = useState('');
    const [prev, setPrev] = useState<Note | null>(null);
    const [processing, setProcessing] = useState(false);

    if (prev !== note) {
        setPrev(note);
        setTitle(note?.title ?? '');
    }

    const save = async () => {
        if (!note) {
            return;
        }

        setProcessing(true);

        try {
            const response = await notesApi.rename(note.id, title);
            onRenamed(note, response.note.title);
            onClose();
        } catch (error) {
            failure(error);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <ActionShell
            open={note !== null}
            onOpenChange={(open) => !open && onClose()}
            title="Ganti nama"
            mobile={mobile}
            footer={
                <>
                    {!mobile && (
                        <Button variant="quiet" onClick={onClose}>
                            Batal
                        </Button>
                    )}
                    <Button
                        type="submit"
                        form="rename-note-form"
                        disabled={processing}
                        size={mobile ? 'lg' : 'default'}
                        className={mobile ? 'w-full' : undefined}
                    >
                        {processing && <Spinner />}
                        Simpan
                    </Button>
                </>
            }
        >
            <form
                id="rename-note-form"
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                }}
            >
                <Label htmlFor="rename-note-title">Judul</Label>
                <Input
                    id="rename-note-title"
                    value={title}
                    maxLength={200}
                    autoFocus={!mobile}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </form>
        </ActionShell>
    );
}

/** "Hapus": soft delete; a folder's content moves one level up. */
export function DeleteDialog({
    note,
    mobile,
    backToWorkspace,
    backToParent = false,
    onClose,
    onDeleted,
}: {
    note: Note | null;
    mobile: boolean;
    backToWorkspace: boolean;
    /** A document tab: back to the note above it (?kembali=induk). */
    backToParent?: boolean;
    onClose: () => void;
    onDeleted?: (note: Note) => void;
}) {
    const [processing, setProcessing] = useState(false);

    const remove = () => {
        if (!note) {
            return;
        }

        router.delete(
            notesRoutes.destroy.url(note.id, {
                query: backToParent
                    ? { kembali: 'induk' }
                    : backToWorkspace
                      ? { kembali: 'workspace' }
                      : undefined,
            }),
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => {
                    onDeleted?.(note);
                    onClose();
                },
                onError: () => toast.error('Gagal menghapus. Coba lagi.'),
            },
        );
    };

    const folder = note?.kind === 'folder';

    return (
        <ActionShell
            open={note !== null}
            onOpenChange={(open) => !open && onClose()}
            title={folder ? 'Hapus folder?' : 'Hapus catatan?'}
            description={
                folder
                    ? `${note?.title ?? ''} dihapus; isinya dipindah ke tingkat di atasnya.`
                    : `${note?.title ?? ''} dan riwayat versinya tidak tampil lagi.`
            }
            mobile={mobile}
            footer={
                <>
                    {!mobile && (
                        <Button variant="quiet" onClick={onClose}>
                            Batal
                        </Button>
                    )}
                    <Button
                        variant="destructive"
                        onClick={remove}
                        disabled={processing}
                        size={mobile ? 'lg' : 'default'}
                        className={mobile ? 'w-full' : undefined}
                    >
                        {processing && <Spinner />}
                        Hapus
                    </Button>
                </>
            }
        />
    );
}

/**
 * Row actions of a note tree (list pages): new note/folder inside a folder,
 * rename, move and delete, with optimistic list updates and rollback on
 * error (the next Inertia reload brings the server state).
 */
export function useTreeActions({
    notes,
    workspaces,
    mobile,
    backToWorkspace = false,
}: {
    notes: Note[];
    workspaces: NoteWorkspace[];
    mobile: boolean;
    backToWorkspace?: boolean;
}) {
    const [overrides, setOverrides] = useState<Record<string, Partial<Note>>>(
        {},
    );
    const [creating, setCreating] = useState<NewNoteDefaults | null>(null);
    const [renaming, setRenaming] = useState<Note | null>(null);
    const [moving, setMoving] = useState<Note | null>(null);
    const [deleting, setDeleting] = useState<Note | null>(null);
    const [lastDefaults, setLastDefaults] = useState<NewNoteDefaults>({
        kind: 'note',
    });

    const rows = notes.map((note) =>
        overrides[note.id] ? { ...note, ...overrides[note.id] } : note,
    );
    const patch = (id: string, changes: Partial<Note>) =>
        setOverrides((current) => ({
            ...current,
            [id]: { ...current[id], ...changes },
        }));
    const reload = () =>
        router.reload({
            only: ['notes'],
            onSuccess: () => setOverrides({}),
        });

    const openNew = (defaults: NewNoteDefaults) => {
        setLastDefaults(defaults);
        setCreating(defaults);
    };

    const onAction = (action: TreeAction, note: Note) => {
        switch (action) {
            case 'new-note':
            case 'new-folder':
                openNew({
                    kind: action === 'new-folder' ? 'folder' : 'note',
                    workspaceId: note.workspace_id,
                    parentId: note.id,
                });
                break;
            case 'rename':
                setRenaming(note);
                break;
            case 'move':
                setMoving(note);
                break;
            case 'delete':
                setDeleting(note);
                break;
        }
    };

    const dialogs = (
        <>
            <NewNoteDialog
                open={creating !== null}
                onOpenChange={(open) => !open && setCreating(null)}
                workspaces={workspaces}
                notes={rows}
                defaults={creating ?? lastDefaults}
                mobile={mobile}
            />
            <RenameDialog
                note={renaming}
                mobile={mobile}
                onClose={() => setRenaming(null)}
                onRenamed={(note, title) => {
                    patch(note.id, { title });
                    reload();
                }}
            />
            <MoveDialog
                note={moving}
                notes={rows}
                mobile={mobile}
                onClose={() => setMoving(null)}
                onMoved={(note, parentId) => {
                    patch(note.id, { parent_id: parentId });
                    reload();
                }}
            />
            <DeleteDialog
                note={deleting}
                mobile={mobile}
                backToWorkspace={backToWorkspace}
                onClose={() => setDeleting(null)}
            />
        </>
    );

    return { rows, onAction, openNew, dialogs };
}
