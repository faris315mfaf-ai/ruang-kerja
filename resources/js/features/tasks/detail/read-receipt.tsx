import { Check, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AvatarStack } from '../avatar-stack';
import type { Person } from '../types';
import {
    namesLabel,
    readersOf,
    receiptSummary,
    unreadMentions,
} from './comment-reads';
import type { CommentRead, TaskComment } from './types';

type Props = {
    comment: TaskComment;
    reads: CommentRead[];
    viewerId: string | undefined;
    mobile?: boolean;
};

function PersonRow({ person, read }: { person: Person; read?: CommentRead }) {
    return (
        <li className="flex min-h-12 items-center gap-3 py-1.5">
            <UserAvatar
                name={person.name}
                src={person.avatar}
                className="size-8 text-[12px]"
            />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">
                {person.name}
            </span>
            {read && (
                <time
                    dateTime={read.read_at}
                    title={formatDateTime(read.read_at)}
                    className="shrink-0 text-meta text-text-muted"
                >
                    {formatRelative(read.read_at)}
                </time>
            )}
        </li>
    );
}

function ReceiptList({
    readers,
    pending,
}: {
    readers: CommentRead[];
    pending: Person[];
}) {
    return (
        <>
            {readers.length > 0 && (
                <ul aria-label="Sudah membaca">
                    {readers.map((read) => (
                        <PersonRow
                            key={read.user.id}
                            person={read.user}
                            read={read}
                        />
                    ))}
                </ul>
            )}
            {pending.length > 0 && (
                <>
                    <p className="pt-3 pb-1 text-[13px] font-bold tracking-[0.06em] text-text-muted uppercase">
                        Belum dibaca
                    </p>
                    <ul aria-label="Belum membaca">
                        {pending.map((person) => (
                            <PersonRow key={person.id} person={person} />
                        ))}
                    </ul>
                </>
            )}
        </>
    );
}

/**
 * Receipt under a comment (Sprint 6 backlog "read receipts"): "Dibaca oleh 3"
 * with avatars — opens the names and times (dropdown on desktop, bottom
 * sheet on phones) — and "Belum dibaca: Rizky, Sari" for mentioned people
 * who have not reached it. The author and the viewer are never listed.
 */
export function ReadReceipt({
    comment,
    reads,
    viewerId,
    mobile = false,
}: Props) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const readers = readersOf(comment, reads, viewerId);
    const pending = unreadMentions(comment, reads, viewerId);
    const mine = comment.author.id === viewerId;

    if (readers.length === 0 && pending.length === 0 && !mine) {
        return null;
    }

    const summary = receiptSummary(readers, pending);
    const trigger = (
        <button
            type="button"
            aria-label={`${summary} Lihat siapa saja`}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-control font-semibold text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
                mobile ? '-ml-2 h-11 px-2' : '-ml-1.5 h-8 px-1.5',
            )}
            onClick={mobile ? () => setSheetOpen(true) : undefined}
        >
            <CheckCheck className="size-4 text-primary" aria-hidden />
            <span>Dibaca oleh {readers.length}</span>
            <span aria-hidden>
                <AvatarStack
                    people={readers.map((read) => read.user)}
                    max={3}
                />
            </span>
        </button>
    );

    return (
        <div
            className={cn(
                'mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-text-muted',
                !mobile && 'pl-[52px]',
            )}
        >
            {readers.length > 0 ? (
                mobile ? (
                    trigger
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            {trigger}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            className="max-h-80 w-72 overflow-y-auto"
                        >
                            <DropdownMenuLabel>Dibaca oleh</DropdownMenuLabel>
                            <div className="px-3 pb-1">
                                <ReceiptList readers={readers} pending={[]} />
                            </div>
                            {pending.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <div className="px-3 pb-1">
                                        <ReceiptList
                                            readers={[]}
                                            pending={pending}
                                        />
                                    </div>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            ) : (
                mine && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5',
                            mobile ? 'min-h-11' : 'min-h-8',
                        )}
                    >
                        <Check className="size-4" aria-hidden />
                        Belum ada yang membaca
                    </span>
                )
            )}
            {pending.length > 0 && (
                <span
                    className={cn(
                        mobile ? 'min-h-11' : 'min-h-8',
                        'inline-flex items-center',
                    )}
                >
                    Belum dibaca: {namesLabel(pending)}
                </span>
            )}

            {mobile && (
                <BottomSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    title="Dibaca oleh"
                    description={`${readers.length} orang sudah membaca komentar ${comment.author.name.split(' ')[0]}.`}
                >
                    <ReceiptList readers={readers} pending={pending} />
                </BottomSheet>
            )}
        </div>
    );
}
