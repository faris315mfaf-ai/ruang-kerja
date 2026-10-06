import { Link2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ApiError } from '@/features/tasks/lib/api';
import { cn } from '@/lib/utils';
import { notesApi } from './api';
import type {
    Note,
    NoteAccessRole,
    NotePerson,
    NoteShare,
    NoteWorkspace,
} from './types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    note: Note;
    workspace: NoteWorkspace | undefined;
    share: NoteShare;
    people: NotePerson[];
    viewerId: string;
    onSaved: (share: NoteShare) => void;
    mobile?: boolean;
};

/**
 * "Bagikan": workspace or invited-only access, per-person edit/read rights
 * (PUT /catatan/{note}/akses, audited). Open editing sessions reconnect with
 * the new rights.
 */
export function ShareDialog({
    open,
    onOpenChange,
    note,
    workspace,
    share,
    people,
    viewerId,
    onSaved,
    mobile = false,
}: Props) {
    const [draft, setDraft] = useState<NoteShare>(share);
    const [prevShare, setPrevShare] = useState(share);
    const [adding, setAdding] = useState('');
    const [processing, setProcessing] = useState(false);

    if (prevShare !== share) {
        setPrevShare(share);
        setDraft(share);
    }

    const others = people.filter(
        (person) =>
            person.id !== note.created_by &&
            !draft.people.some((item) => item.user_id === person.id),
    );
    const author = people.find((person) => person.id === note.created_by);

    const setRole = (userId: string, role: NoteAccessRole | 'remove') =>
        setDraft((current) => ({
            ...current,
            people:
                role === 'remove'
                    ? current.people.filter((item) => item.user_id !== userId)
                    : current.people.map((item) =>
                          item.user_id === userId ? { ...item, role } : item,
                      ),
        }));

    const save = async () => {
        setProcessing(true);

        try {
            const response = await notesApi.share(
                note.id,
                draft.access,
                draft.people,
            );
            onSaved(response.share);
            toast.success('Akses catatan diperbarui.');
            onOpenChange(false);
        } catch (error) {
            setDraft(share);
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : 'Akses gagal disimpan. Coba lagi.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const copyLink = () => {
        void navigator.clipboard
            ?.writeText(`${window.location.origin}/catatan/${note.id}`)
            .then(() => toast.success('Tautan catatan disalin.'));
    };

    const body = (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <p className="text-[15px] font-semibold text-text">
                    Akses umum
                </p>
                <SegmentedTabs
                    label="Akses umum"
                    semantics="radio"
                    value={draft.access}
                    onValueChange={(access) =>
                        setDraft((current) => ({ ...current, access }))
                    }
                    options={[
                        { value: 'workspace', label: 'Workspace' },
                        { value: 'restricted', label: 'Hanya diundang' },
                    ]}
                    className="w-full [&>button]:flex-1"
                />
                <p className="text-[14px] leading-5 text-text-muted">
                    {draft.access === 'workspace'
                        ? `Semua yang bisa membuka ${workspace?.name ?? 'workspace'} dapat membaca; anggota yang menyunting tugas juga bisa menyunting.`
                        : `Hanya ${author ? author.name.split(' ')[0] : 'penulis'} dan orang di daftar ini yang dapat membuka catatan. Direksi dan HR tidak melihatnya otomatis.`}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <p className="text-[15px] font-semibold text-text">
                    Orang dengan akses
                </p>
                {draft.people.length === 0 && (
                    <p className="text-[14px] text-text-muted">
                        Belum ada orang yang diundang khusus.
                    </p>
                )}
                <ul className="flex flex-col">
                    {draft.people.map((item) => {
                        const person = people.find(
                            (candidate) => candidate.id === item.user_id,
                        );

                        if (!person) {
                            return null;
                        }

                        const self = person.id === viewerId;

                        return (
                            <li
                                key={item.user_id}
                                className="flex min-h-14 items-center gap-3"
                            >
                                <UserAvatar
                                    name={person.name}
                                    className="size-9 text-[13px]"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[15px] font-semibold text-text">
                                        {person.name}
                                        {self && ' (Anda)'}
                                    </span>
                                    <span className="truncate text-[13px] text-text-muted">
                                        {person.title}
                                    </span>
                                </span>
                                <Select
                                    value={item.role}
                                    disabled={self}
                                    onValueChange={(value) =>
                                        setRole(
                                            person.id,
                                            value as NoteAccessRole | 'remove',
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        aria-label={`Akses ${person.name}`}
                                        className={cn(
                                            'shrink-0',
                                            mobile ? 'w-36' : 'w-44',
                                        )}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="edit">
                                            Menyunting
                                        </SelectItem>
                                        <SelectItem value="view">
                                            Membaca
                                        </SelectItem>
                                        <SelectItem value="remove">
                                            Hapus akses
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </li>
                        );
                    })}
                </ul>
                {others.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Select value={adding} onValueChange={setAdding}>
                            <SelectTrigger
                                aria-label="Undang orang"
                                className="min-w-0 flex-1"
                            >
                                <SelectValue placeholder="Undang orang…" />
                            </SelectTrigger>
                            <SelectContent>
                                {others.map((person) => (
                                    <SelectItem
                                        key={person.id}
                                        value={person.id}
                                    >
                                        {person.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="tonal"
                            disabled={adding === ''}
                            onClick={() => {
                                setDraft((current) => ({
                                    ...current,
                                    people: [
                                        ...current.people,
                                        { user_id: adding, role: 'view' },
                                    ],
                                }));
                                setAdding('');
                            }}
                        >
                            <UserPlus aria-hidden />
                            Undang
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );

    const actions = (
        <div
            className={cn(
                'flex gap-3',
                mobile ? 'flex-col' : 'w-full items-center',
            )}
        >
            <Button
                variant="outline"
                onClick={copyLink}
                className={cn(!mobile && 'mr-auto')}
                size={mobile ? 'lg' : 'default'}
            >
                <Link2 aria-hidden />
                Salin tautan
            </Button>
            <Button
                onClick={() => void save()}
                disabled={processing}
                size={mobile ? 'lg' : 'default'}
            >
                {processing && <Spinner />}
                Simpan akses
            </Button>
        </div>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Bagikan catatan"
                description={note.title}
                footer={actions}
            >
                {body}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Bagikan catatan</DialogTitle>
                    <DialogDescription>{note.title}</DialogDescription>
                </DialogHeader>
                {body}
                <DialogFooter>{actions}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
