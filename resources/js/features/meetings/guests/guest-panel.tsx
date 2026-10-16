import {
    Check,
    Copy,
    Link2,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/features/tasks/lib/api';
import { isEmail } from '../lib';
import { copyText } from './clipboard';
import {
    GUEST_NAME_MAX,
    guestLabel,
    guestStatusText,
    guestStatusTone,
    linkExpiryLabel,
    maskGuestLink,
    validateOptionalGuestName,
    waitingSince,
} from './lib';
import type { OrganizerGuest } from './types';
import { guestErrorMessage, useGuests } from './use-guests';

/** Copies a guest's personal link and confirms with a toast. */
export async function copyGuestLink(guest: OrganizerGuest): Promise<void> {
    const copied = await copyText(guest.link_url);

    if (copied) {
        toast.success(`Tautan ${guestLabel(guest)} disalin`, {
            description:
                'Kirim lewat WhatsApp atau email Anda. Tautan ini pribadi.',
        });
    } else {
        toast.error(
            'Tautan belum bisa disalin. Izinkan akses clipboard di browser lalu coba lagi.',
        );
    }
}

function AddGuestForm({
    onAdd,
    onCancel,
    full,
}: {
    onAdd: (email: string, name: string | null) => Promise<OrganizerGuest>;
    onCancel: () => void;
    full: boolean;
}) {
    const id = useId();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        const next: typeof errors = {};

        if (!isEmail(email)) {
            next.email = 'Tulis alamat email tamu yang valid.';
        }

        const nameProblem = validateOptionalGuestName(name);

        if (nameProblem) {
            next.name = nameProblem;
        }

        setErrors(next);

        if (next.email || next.name) {
            return;
        }

        setBusy(true);

        try {
            const guest = await onAdd(
                email.trim().toLowerCase(),
                name.trim() === '' ? null : name.trim(),
            );

            toast.success(`${guestLabel(guest)} ditambahkan`, {
                action: {
                    label: 'Salin tautan',
                    onClick: () => void copyGuestLink(guest),
                },
            });
            setEmail('');
            setName('');
            onCancel();
        } catch (failure) {
            const messages = failure instanceof ApiError ? failure.errors : {};

            setErrors({
                email:
                    messages.email?.[0] ??
                    guestErrorMessage(
                        failure,
                        'Tamu belum bisa ditambahkan. Coba lagi.',
                    ),
                name: messages.name?.[0],
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            onSubmit={(event) => void submit(event)}
            noValidate
            className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4"
            aria-label="Tambah tamu"
        >
            <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-email`}>Email tamu</Label>
                    <Input
                        id={`${id}-email`}
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        autoCapitalize="none"
                        value={email}
                        placeholder="nama@perusahaan.com"
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={
                            errors.email ? `${id}-email-err` : undefined
                        }
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-12 text-[17px] md:h-11 md:text-[16px]"
                    />
                    {errors.email && (
                        <p
                            id={`${id}-email-err`}
                            role="alert"
                            className="text-[14px] text-danger"
                        >
                            {errors.email}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-name`}>Nama (opsional)</Label>
                    <Input
                        id={`${id}-name`}
                        value={name}
                        maxLength={GUEST_NAME_MAX + 20}
                        autoComplete="off"
                        placeholder="Mis. Budi Santoso"
                        aria-invalid={errors.name ? true : undefined}
                        aria-describedby={
                            errors.name ? `${id}-name-err` : undefined
                        }
                        onChange={(event) => setName(event.target.value)}
                        className="h-12 text-[17px] md:h-11 md:text-[16px]"
                    />
                    {errors.name && (
                        <p
                            id={`${id}-name-err`}
                            role="alert"
                            className="text-[14px] text-danger"
                        >
                            {errors.name}
                        </p>
                    )}
                </div>
            </div>
            {full && (
                <p role="alert" className="text-[14px] text-danger">
                    Batas jumlah tamu per rapat sudah tercapai.
                </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
                <Button
                    type="button"
                    variant="quiet"
                    onClick={onCancel}
                    disabled={busy}
                >
                    Batal
                </Button>
                <Button type="submit" disabled={busy || full}>
                    {busy ? <Spinner aria-hidden /> : <Plus aria-hidden />}
                    Tambah tamu
                </Button>
            </div>
        </form>
    );
}

type Confirm = { kind: 'rotate' | 'revoke'; guest: OrganizerGuest } | null;

function GuestRow({
    guest,
    now,
    busy,
    onCopy,
    onDecide,
    onAsk,
}: {
    guest: OrganizerGuest;
    now: number;
    busy: boolean;
    onCopy: () => void;
    onDecide: (admit: boolean) => void;
    onAsk: (kind: 'rotate' | 'revoke') => void;
}) {
    const label = guestLabel(guest);
    const expiry = linkExpiryLabel(guest, now);
    const since = waitingSince(guest.requested_at, now);
    const canAdmitAgain =
        guest.status === 'removed' || guest.status === 'denied';

    return (
        <li
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
            data-testid="guest-row"
            data-status={guest.status}
        >
            <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={label} className="size-10 text-[15px]" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-semibold">
                        {label}
                    </span>
                    {guest.name && (
                        <span className="truncate text-[14px] text-text-muted">
                            {guest.email}
                        </span>
                    )}
                </span>
                <Badge
                    variant="status"
                    tone={guestStatusTone(guest)}
                    dot
                    className="h-7 px-2.5 text-[13px]"
                >
                    {guestStatusText(guest)}
                </Badge>
            </div>
            <p
                className="flex items-center gap-1.5 text-[13px] text-text-muted"
                title={`Tautan pribadi ${maskGuestLink(guest.link_url)}`}
            >
                <Link2 aria-hidden className="size-3.5 shrink-0" />
                <span className="font-mono">
                    {maskGuestLink(guest.link_url)}
                </span>
                {expiry && <span>· {expiry}</span>}
                {guest.status === 'waiting' && since && (
                    <span>· menunggu {since}</span>
                )}
            </p>
            <div className="flex flex-wrap gap-2">
                {guest.status === 'waiting' && (
                    <>
                        <Button
                            className="h-11"
                            disabled={busy}
                            onClick={() => onDecide(true)}
                        >
                            {busy ? <Spinner /> : <Check aria-hidden />}
                            Izinkan masuk
                        </Button>
                        <Button
                            variant="outline"
                            className="h-11"
                            disabled={busy}
                            onClick={() => onDecide(false)}
                            aria-label={`Tolak ${label}`}
                        >
                            <X aria-hidden />
                            Tolak
                        </Button>
                    </>
                )}
                {canAdmitAgain && (
                    <Button
                        className="h-11"
                        disabled={busy}
                        onClick={() => onDecide(true)}
                    >
                        {busy ? <Spinner /> : <Check aria-hidden />}
                        Izinkan masuk lagi
                    </Button>
                )}
                <Button
                    variant="outline"
                    className="h-11"
                    onClick={onCopy}
                    aria-label={`Salin tautan ${label}`}
                >
                    <Copy aria-hidden />
                    Salin tautan
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Opsi tamu ${label}`}
                        >
                            <MoreHorizontal aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onAsk('rotate')}>
                            <RefreshCw aria-hidden />
                            Putar ulang tautan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onAsk('revoke')}
                        >
                            <Trash2 aria-hidden />
                            Cabut tamu
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </li>
    );
}

function ConfirmDialog({
    confirm,
    busy,
    onCancel,
    onConfirm,
}: {
    confirm: Confirm;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const rotate = confirm?.kind === 'rotate';
    const name = confirm ? guestLabel(confirm.guest) : '';

    return (
        <Dialog open={confirm !== null} onOpenChange={(o) => !o && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {rotate
                            ? `Putar ulang tautan ${name}?`
                            : `Cabut ${name} dari rapat?`}
                    </DialogTitle>
                    <DialogDescription>
                        {rotate
                            ? 'Tautan lama langsung mati dan tamu yang sedang di ruang rapat dikeluarkan. Anda mendapat tautan baru untuk dikirim ulang, dan tamu perlu meminta izin masuk lagi.'
                            : 'Tamu dihapus dari daftar, tautannya mati, dan bila sedang di ruang rapat ia dikeluarkan. Anda bisa menambahkannya lagi nanti dengan tautan baru.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="quiet" onClick={onCancel} disabled={busy}>
                        Batal
                    </Button>
                    <Button
                        variant={rotate ? 'default' : 'destructive'}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy && <Spinner aria-hidden />}
                        {rotate ? 'Putar ulang tautan' : 'Cabut tamu'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * "Tamu eksternal" on the detail of a Video RuangKerja meeting — for the
 * organizer only (MeetingPolicy::manageGuests). Lists each guest with status,
 * a personal link to copy (no e-mail is ever sent), rotate / revoke with
 * confirmation, the lobby decisions and an add form.
 */
export function GuestPanel({
    meetingId,
    date,
    now,
    canceled = false,
}: {
    meetingId: string;
    date: string | null;
    now: number;
    canceled?: boolean;
}) {
    const guests = useGuests({ meetingId, date, enabled: true });
    const [adding, setAdding] = useState(false);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [working, setWorking] = useState<ReadonlySet<string>>(new Set());
    const [confirming, setConfirming] = useState(false);

    if (guests.forbidden) {
        return null;
    }

    const full = guests.guests.length >= guests.limit;

    const track = async (id: string, run: () => Promise<unknown>) => {
        setWorking((set) => new Set(set).add(id));

        try {
            await run();

            return true;
        } catch (failure) {
            toast.error(guestErrorMessage(failure, 'Aksi gagal. Coba lagi.'));

            return false;
        } finally {
            setWorking((set) => {
                const next = new Set(set);

                next.delete(id);

                return next;
            });
        }
    };

    const runConfirm = async () => {
        if (!confirm) {
            return;
        }

        setConfirming(true);

        const { kind, guest } = confirm;
        const ok = await track(guest.id, async () => {
            if (kind === 'rotate') {
                const fresh = await guests.rotate(guest.id);

                toast.success('Tautan baru dibuat', {
                    description: 'Tautan lama sudah tidak berlaku.',
                    action: {
                        label: 'Salin tautan',
                        onClick: () => void copyGuestLink(fresh),
                    },
                });
            } else {
                await guests.revoke(guest.id);
                toast.success(`${guestLabel(guest)} dicabut`);
            }
        });

        setConfirming(false);

        if (ok) {
            setConfirm(null);
        }
    };

    return (
        <Panel
            title="Tamu eksternal"
            action={
                <span className="text-[15px] font-bold text-link tnum">
                    {guests.guests.length} dari {guests.limit}
                </span>
            }
            bodyClassName="gap-4"
        >
            <p className="text-[15px] leading-[22px] text-text-muted">
                Tamu tidak menerima email dari aplikasi. Salin tautan pribadi
                tiap tamu lalu kirim sendiri lewat WhatsApp atau email. Tamu
                mengisi nama, menunggu, lalu Anda atau peserta lain mengizinkan
                masuk.
            </p>

            {!guests.loaded ? (
                <div aria-busy className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : guests.error ? (
                <div
                    role="alert"
                    className="flex flex-wrap items-center gap-3 rounded-control bg-danger-soft px-4 py-3 text-[15px] text-danger"
                >
                    <span className="min-w-0 flex-1">{guests.error}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void guests.reload()}
                    >
                        Coba lagi
                    </Button>
                </div>
            ) : guests.guests.length === 0 ? (
                <p
                    role="status"
                    className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-[15px] text-text-muted"
                >
                    <Link2 aria-hidden className="size-7" />
                    Belum ada tamu. Tambahkan email tamu untuk mendapat tautan
                    pribadinya.
                </p>
            ) : (
                <ul
                    aria-label="Daftar tamu"
                    className="flex flex-col divide-y divide-divider"
                >
                    {guests.guests.map((guest) => (
                        <GuestRow
                            key={guest.id}
                            guest={guest}
                            now={now}
                            busy={working.has(guest.id)}
                            onCopy={() => void copyGuestLink(guest)}
                            onDecide={(admit) =>
                                void track(guest.id, () =>
                                    guests.decide(guest.id, admit),
                                )
                            }
                            onAsk={(kind) => setConfirm({ kind, guest })}
                        />
                    ))}
                </ul>
            )}

            {adding ? (
                <AddGuestForm
                    full={full}
                    onAdd={guests.add}
                    onCancel={() => setAdding(false)}
                />
            ) : (
                !canceled && (
                    <Button
                        variant="outline"
                        className="self-start"
                        disabled={full}
                        onClick={() => setAdding(true)}
                    >
                        <Plus aria-hidden />
                        Tambah tamu
                    </Button>
                )
            )}

            <ConfirmDialog
                confirm={confirm}
                busy={confirming}
                onCancel={() => setConfirm(null)}
                onConfirm={() => void runConfirm()}
            />
        </Panel>
    );
}
