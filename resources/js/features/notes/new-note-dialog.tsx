import { router } from '@inertiajs/react';
import { useState } from 'react';
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
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { createNote } from './store';
import type { NotesState } from './types';

const NO_PARENT = '__root';

/** "Catatan baru": title, workspace, optional parent page. */
export function NewNoteDialog({
    open,
    onOpenChange,
    state,
    defaultWorkspaceId,
    mobile = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    state: NotesState;
    defaultWorkspaceId?: string;
    mobile?: boolean;
}) {
    const [title, setTitle] = useState('');
    const [workspaceId, setWorkspaceId] = useState(
        defaultWorkspaceId ?? state.workspaces[0]?.id ?? '',
    );
    const [parentId, setParentId] = useState(NO_PARENT);
    const [touched, setTouched] = useState(false);
    const { processing, run } = useFakeMutation();
    const parents = state.notes.filter(
        (note) => note.workspace_id === workspaceId && note.parent_id === null,
    );
    const error = title.trim() === '' ? 'Judul catatan wajib diisi.' : null;

    const submit = async () => {
        setTouched(true);

        if (error) {
            return;
        }

        let id = '';
        const ok = await run(
            () => {
                id = createNote({
                    title,
                    workspaceId,
                    parentId: parentId === NO_PARENT ? null : parentId,
                });
            },
            { delay: 400 },
        );

        if (ok) {
            setTitle('');
            setParentId(NO_PARENT);
            setTouched(false);
            onOpenChange(false);
            router.visit(`/catatan/${id}`);
        }
    };

    const body = (
        <form
            id="new-note-form"
            className="flex flex-col gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="new-note-title">Judul</Label>
                <Input
                    id="new-note-title"
                    value={title}
                    autoFocus={!mobile}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="mis. Notulen rapat mingguan 5 Okt"
                    aria-invalid={touched && error !== null}
                    aria-describedby={
                        touched && error ? 'new-note-error' : undefined
                    }
                />
                {touched && error && (
                    <p id="new-note-error" className="text-[14px] text-danger">
                        {error}
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="new-note-workspace">Workspace</Label>
                <Select
                    value={workspaceId}
                    onValueChange={(value) => {
                        setWorkspaceId(value);
                        setParentId(NO_PARENT);
                    }}
                >
                    <SelectTrigger id="new-note-workspace">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {state.workspaces.map((workspace) => (
                            <SelectItem key={workspace.id} value={workspace.id}>
                                {workspace.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="new-note-parent">Di bawah catatan</Label>
                <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger id="new-note-parent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_PARENT}>
                            Tidak ada (halaman utama)
                        </SelectItem>
                        {parents.map((note) => (
                            <SelectItem key={note.id} value={note.id}>
                                {note.title}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </form>
    );

    const action = (
        <Button
            type="submit"
            form="new-note-form"
            disabled={processing}
            size={mobile ? 'lg' : 'default'}
            className={cn(mobile && 'w-full')}
        >
            {processing && <Spinner />}
            Buat catatan
        </Button>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Catatan baru"
                footer={action}
            >
                {body}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Catatan baru</DialogTitle>
                    <DialogDescription>
                        Catatan bisa diedit bersama anggota workspace secara
                        langsung.
                    </DialogDescription>
                </DialogHeader>
                {body}
                <DialogFooter>
                    <Button variant="quiet" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    {action}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
