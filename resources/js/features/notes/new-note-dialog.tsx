import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
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
import { SegmentedTabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import notesRoutes from '@/routes/notes';
import { parentOptions } from './lib';
import type { Note, NoteKind, NoteWorkspace } from './types';

const NO_PARENT = '__root';

export type NewNoteDefaults = {
    kind: NoteKind;
    workspaceId?: string;
    parentId?: string | null;
};

/**
 * "Catatan baru" / "Folder baru": kind, title, workspace (when not fixed)
 * and the folder or note it goes under. A new note opens in the editor; a
 * new folder stays on the list.
 */
export function NewNoteDialog({
    open,
    onOpenChange,
    workspaces,
    notes,
    defaults,
    mobile = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Workspaces the viewer may write in (one = fixed, no picker). */
    workspaces: NoteWorkspace[];
    notes: Note[];
    defaults: NewNoteDefaults;
    mobile?: boolean;
}) {
    const writable = workspaces.filter((workspace) => workspace.can_create);
    const [kind, setKind] = useState<NoteKind>(defaults.kind);
    const [title, setTitle] = useState('');
    const [workspaceId, setWorkspaceId] = useState(
        defaults.workspaceId ?? writable[0]?.id ?? '',
    );
    const [parentId, setParentId] = useState(defaults.parentId ?? NO_PARENT);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [prevDefaults, setPrevDefaults] = useState(defaults);
    const titleField = useRef<HTMLInputElement>(null);

    // Reopened from another row/button: start from its defaults.
    if (prevDefaults !== defaults) {
        setPrevDefaults(defaults);
        setKind(defaults.kind);
        setWorkspaceId(defaults.workspaceId ?? writable[0]?.id ?? '');
        setParentId(defaults.parentId ?? NO_PARENT);
        setTitle('');
        setError(null);
    }

    const parents = parentOptions(
        notes.filter((note) => note.workspace_id === workspaceId),
        kind,
    );
    const noun = kind === 'folder' ? 'folder' : 'catatan';

    const submit = () => {
        if (title.trim() === '') {
            setError(`Judul ${noun} wajib diisi.`);

            return;
        }

        router.post(
            notesRoutes.store.url(),
            {
                title,
                kind,
                workspace_id: workspaceId,
                parent_id: parentId === NO_PARENT ? null : parentId,
            },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) =>
                    setError(
                        errors.title ??
                            errors.parent_id ??
                            errors.workspace_id ??
                            `${kind === 'folder' ? 'Folder' : 'Catatan'} gagal dibuat.`,
                    ),
                onSuccess: () => {
                    setTitle('');
                    setError(null);
                    onOpenChange(false);
                },
            },
        );
    };

    const body = (
        <form
            id="new-note-form"
            className="flex flex-col gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <SegmentedTabs
                label="Jenis"
                semantics="radio"
                value={kind}
                onValueChange={(value) => {
                    setKind(value);
                    // A folder only goes inside a folder.
                    if (
                        value === 'folder' &&
                        notes.find((note) => note.id === parentId)?.kind !==
                            'folder'
                    ) {
                        setParentId(NO_PARENT);
                    }
                }}
                options={[
                    { value: 'note', label: 'Catatan' },
                    { value: 'folder', label: 'Folder' },
                ]}
                className="w-full [&>button]:flex-1"
            />
            <div className="flex flex-col gap-2">
                <Label htmlFor="new-note-title">Judul</Label>
                <Input
                    id="new-note-title"
                    value={title}
                    maxLength={200}
                    ref={titleField}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={
                        kind === 'folder'
                            ? 'mis. SOP & panduan'
                            : 'mis. Notulen rapat mingguan 5 Okt'
                    }
                    aria-invalid={error !== null}
                    aria-describedby={error ? 'new-note-error' : undefined}
                />
                {error && (
                    <p id="new-note-error" className="text-[14px] text-danger">
                        {error}
                    </p>
                )}
            </div>
            {writable.length > 1 && (
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
                            {writable.map((workspace) => (
                                <SelectItem
                                    key={workspace.id}
                                    value={workspace.id}
                                >
                                    {workspace.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="flex flex-col gap-2">
                <Label htmlFor="new-note-parent">
                    {kind === 'folder' ? 'Di dalam folder' : 'Letak'}
                </Label>
                <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger id="new-note-parent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_PARENT}>
                            Tingkat atas (tanpa folder)
                        </SelectItem>
                        {parents.map((note) => (
                            <SelectItem key={note.id} value={note.id}>
                                {note.title}
                                {note.kind === 'folder' ? ' (folder)' : ''}
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
            disabled={processing || workspaceId === ''}
            size={mobile ? 'lg' : 'default'}
            className={cn(mobile && 'w-full')}
        >
            {processing && <Spinner />}
            {kind === 'folder' ? 'Buat folder' : 'Buat catatan'}
        </Button>
    );

    const heading = kind === 'folder' ? 'Folder baru' : 'Catatan baru';

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={heading}
                footer={action}
            >
                {body}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onOpenAutoFocus={(event) => {
                    // Straight into the title (not the kind switch).
                    event.preventDefault();
                    titleField.current?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>{heading}</DialogTitle>
                    <DialogDescription>
                        {kind === 'folder'
                            ? 'Kelompokkan catatan di dalam folder; folder bisa bersarang.'
                            : 'Catatan tersimpan otomatis dan bisa disunting bersama anggota workspace.'}
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
