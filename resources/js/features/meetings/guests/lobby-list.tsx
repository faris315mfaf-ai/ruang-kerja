import { Check, DoorOpen, X } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useNow } from '../meetings-context';
import { guestLabel, waitingSince } from './lib';
import type { LobbyEntry } from './types';

/**
 * Guests waiting to be let in, each with Izinkan masuk / Tolak. The typed
 * name is what the guest called themselves; the e-mail (from the organizer's
 * invitation) is shown small so a stranger who got hold of a link stands out.
 * Used in the room panel, the pre-join and the meeting detail.
 */
export function LobbyList({
    waiting,
    busy,
    onAdmit,
    onDeny,
    error,
    className,
}: {
    waiting: LobbyEntry[];
    busy: ReadonlySet<string>;
    onAdmit: (id: string) => void;
    onDeny: (id: string) => void;
    error?: string | null;
    className?: string;
}) {
    // Only this list re-renders as "menunggu 3 menit" ages.
    const now = useNow(20_000);

    if (waiting.length === 0) {
        return (
            <p
                role="status"
                className={cn(
                    'flex flex-col items-center gap-2 py-8 text-center text-[15px] text-text-muted',
                    className,
                )}
            >
                <DoorOpen aria-hidden className="size-8" />
                Tidak ada tamu yang menunggu.
            </p>
        );
    }

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {error && (
                <p
                    role="alert"
                    className="rounded-control bg-warning-soft px-3 py-2 text-[14px] text-warning"
                >
                    {error}
                </p>
            )}
            <ul
                aria-label="Tamu menunggu diizinkan masuk"
                aria-live="polite"
                className="flex flex-col divide-y divide-divider"
            >
                {waiting.map((entry) => {
                    const label = guestLabel(entry);
                    const since = waitingSince(entry.requested_at, now);
                    const working = busy.has(entry.id);

                    return (
                        <li
                            key={entry.id}
                            className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0"
                            data-testid="lobby-entry"
                        >
                            <span className="flex min-w-0 items-center gap-3">
                                <UserAvatar
                                    name={label}
                                    className="size-9 text-[14px]"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] font-semibold">
                                        {label}
                                    </span>
                                    <span className="truncate text-[13px] text-text-muted">
                                        {entry.name && entry.email
                                            ? `${entry.email} · `
                                            : ''}
                                        menunggu {since ?? 'sekarang'}
                                    </span>
                                </span>
                            </span>
                            <span className="flex gap-2">
                                <Button
                                    className="h-11 flex-1"
                                    disabled={working}
                                    onClick={() => onAdmit(entry.id)}
                                >
                                    {working ? (
                                        <Spinner />
                                    ) : (
                                        <Check aria-hidden />
                                    )}
                                    Izinkan masuk
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-11"
                                    disabled={working}
                                    onClick={() => onDeny(entry.id)}
                                    aria-label={`Tolak ${label}`}
                                >
                                    <X aria-hidden />
                                    Tolak
                                </Button>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
