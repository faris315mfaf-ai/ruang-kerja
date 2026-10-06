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
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { saveShare } from './store';
import type {
    Note,
    NoteAccessRole,
    NoteShare,
    NotesState,
    NoteWorkspace,
} from './types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    note: Note;
    workspace: NoteWorkspace | undefined;
    share: NoteShare;
    state: NotesState;
    mobile?: boolean;
};

/** "Bagikan": workspace or invited-only access, per-person edit/read rights. */
export function ShareDialog({
    open,
    onOpenChange,
    note,
    workspace,
    share,
    state,
    mobile = false,
}: Props) {
    const [draft, setDraft] = useState<NoteShare>(share);
    const [prevShare, setPrevShare] = useState(share);
    const [adding, setAdding] = useState('');
    const { processing, run } = useFakeMutation();

    if (prevShare !== share) {
        setPrevShare(share);
        setDraft(share);
    }

    const others = state.people.filter(
        (person) => !draft.people.some((item) => item.user_id === person.id),
    );

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
        const ok = await run(() => saveShare(draft), {
            success: 'Akses catatan diperbarui.',
        });

        if (ok) {
            onOpenChange(false);
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
                        ? `Semua anggota ${workspace?.name ?? 'workspace'} dapat membuka dan menyunting.`
                        : 'Hanya orang di daftar ini yang dapat membuka catatan.'}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <p className="text-[15px] font-semibold text-text">
                    Orang dengan akses
                </p>
                <ul className="flex flex-col">
                    {draft.people.map((item) => {
                        const person = state.people.find(
                            (candidate) => candidate.id === item.user_id,
                        );

                        if (!person) {
                            return null;
                        }

                        const self = person.id === state.viewerId;

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
