import { router } from '@inertiajs/react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { SegmentedTabs } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PresenceDot } from './channel-avatar';
import { chatUrl } from './api';
import { createChannel, openDirect, slugifyChannelName } from './store';
import type { ChatState } from './types';

type Mode = 'channel' | 'direct';

/** Channel name rule: 2–40 characters after slugging. */
export function channelNameError(name: string): string | null {
    const slug = slugifyChannelName(name);

    if (slug.length < 2) {
        return 'Nama channel minimal 2 huruf atau angka.';
    }

    return null;
}

function PeoplePicker({
    state,
    selected,
    onToggle,
    short = false,
}: {
    state: ChatState;
    selected: string[];
    onToggle: (id: string) => void;
    /** Shorter list under the channel fields. */
    short?: boolean;
}) {
    const [query, setQuery] = useState('');
    const people = state.people.filter(
        (person) =>
            person.id !== state.viewerId &&
            person.name.toLowerCase().includes(query.trim().toLowerCase()),
    );

    return (
        <div className="flex flex-col gap-2">
            <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama"
                aria-label="Cari nama rekan"
            />
            <ul
                className={cn(
                    'flex flex-col overflow-y-auto',
                    short ? 'max-h-44' : 'max-h-72',
                )}
            >
                {people.map((person) => (
                    <li key={person.id}>
                        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-control px-2 hover:bg-surface-2">
                            <Checkbox
                                checked={selected.includes(person.id)}
                                onCheckedChange={() => onToggle(person.id)}
                            />
                            <span className="relative">
                                <UserAvatar
                                    name={person.name}
                                    src={person.avatar}
                                    className="size-9 text-[13px]"
                                />
                                <PresenceDot
                                    online={person.online}
                                    className="size-2.5"
                                />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate text-[15px] font-semibold text-text">
                                    {person.name}
                                </span>
                                <span className="truncate text-[13px] text-text-muted">
                                    {person.title}
                                </span>
                            </span>
                        </label>
                    </li>
                ))}
                {people.length === 0 && (
                    <li className="px-2 py-4 text-[15px] text-text-muted">
                        Tidak ada rekan dengan nama itu.
                    </li>
                )}
            </ul>
        </div>
    );
}

/** "Obrolan baru": a channel (name, topic, private, members) or a DM/group. */
export function NewChatDialog({
    open,
    onOpenChange,
    state,
    mobile = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    state: ChatState;
    mobile?: boolean;
}) {
    const [mode, setMode] = useState<Mode>('direct');
    const [name, setName] = useState('');
    const [topic, setTopic] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [touched, setTouched] = useState(false);
    const [processing, setProcessing] = useState(false);
    const nameError = channelNameError(name);

    const reset = () => {
        setName('');
        setTopic('');
        setIsPrivate(false);
        setSelected([]);
        setTouched(false);
    };

    const toggle = (id: string) =>
        setSelected((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );

    const submit = async () => {
        if (mode === 'channel') {
            setTouched(true);

            if (nameError) {
                return;
            }

            setProcessing(true);

            try {
                const id = await createChannel({
                    name,
                    topic,
                    isPrivate,
                    memberIds: selected,
                });
                toast.success(`Channel #${slugifyChannelName(name)} dibuat.`);
                reset();
                onOpenChange(false);
                router.visit(chatUrl(id));
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : 'Channel gagal dibuat.',
                );
            } finally {
                setProcessing(false);
            }

            return;
        }

        if (selected.length === 0) {
            return;
        }

        setProcessing(true);

        try {
            const id = await openDirect(selected);
            reset();
            onOpenChange(false);
            router.visit(chatUrl(id));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Obrolan gagal dibuka.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const body = (
        <div className="flex flex-col gap-5">
            <SegmentedTabs
                label="Jenis obrolan"
                value={mode}
                onValueChange={setMode}
                semantics="radio"
                options={[
                    { value: 'direct', label: 'Pesan langsung' },
                    { value: 'channel', label: 'Channel baru' },
                ]}
                className="w-full [&>button]:flex-1"
            />
            {mode === 'channel' ? (
                <>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="new-channel-name">Nama channel</Label>
                        <Input
                            id="new-channel-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={() => setTouched(true)}
                            placeholder="mis. acara-q4"
                            aria-invalid={touched && nameError !== null}
                            aria-describedby="new-channel-name-hint"
                        />
                        <p
                            id="new-channel-name-hint"
                            className={cn(
                                'text-[14px]',
                                touched && nameError
                                    ? 'text-danger'
                                    : 'text-text-muted',
                            )}
                        >
                            {touched && nameError
                                ? nameError
                                : name.trim() !== ''
                                  ? `Akan tampil sebagai #${slugifyChannelName(name)}`
                                  : 'Huruf kecil, tanpa spasi (diubah otomatis).'}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="new-channel-topic">
                            Topik{' '}
                            <span className="font-normal text-text-muted">
                                (opsional)
                            </span>
                        </Label>
                        <Input
                            id="new-channel-topic"
                            value={topic}
                            onChange={(event) => setTopic(event.target.value)}
                            placeholder="Untuk apa channel ini?"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label
                            htmlFor="new-channel-private"
                            className="flex min-w-0 flex-1 flex-col"
                        >
                            <span className="text-[16px] font-semibold text-text">
                                Channel privat
                            </span>
                            <span className="text-[14px] text-text-muted">
                                Hanya anggota yang diundang bisa melihat
                            </span>
                        </label>
                        <Switch
                            id="new-channel-private"
                            size="md"
                            checked={isPrivate}
                            onCheckedChange={setIsPrivate}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="text-[15px] font-semibold text-text">
                            Undang anggota
                        </p>
                        <PeoplePicker
                            state={state}
                            selected={selected}
                            onToggle={toggle}
                            short
                        />
                    </div>
                </>
            ) : (
                <PeoplePicker
                    state={state}
                    selected={selected}
                    onToggle={toggle}
                />
            )}
        </div>
    );

    const label =
        mode === 'channel'
            ? 'Buat channel'
            : selected.length > 1
              ? `Mulai grup (${selected.length + 1} orang)`
              : 'Mulai obrolan';
    const action = (
        <Button
            onClick={() => void submit()}
            disabled={
                processing || (mode === 'direct' && selected.length === 0)
            }
            size={mobile ? 'lg' : 'default'}
            className={cn(mobile && 'w-full')}
        >
            {processing && <Spinner />}
            {label}
        </Button>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Obrolan baru"
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
                    <DialogTitle>Obrolan baru</DialogTitle>
                    <DialogDescription>
                        Kirim pesan langsung ke rekan atau buat channel untuk
                        topik tertentu.
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
