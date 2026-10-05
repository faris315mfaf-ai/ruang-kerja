import { Link } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    Eye,
    EyeOff,
    Link2,
    Maximize2,
    MoreHorizontal,
    Trash2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { PRIORITY_LABELS, PriorityIcon } from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, focusRing } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import type { Person } from '../types';
import { PresenceBadge } from './presence-badge';
import type { TaskDetailState } from './use-task-detail';
import type { TaskDetail } from './types';

export type DetailNavigation = {
    index: number;
    total: number;
    onPrevious: (() => void) | null;
    onNext: (() => void) | null;
};

type Props = {
    state: TaskDetailState & { detail: TaskDetail };
    viewers: Person[];
    layout: 'sheet' | 'page';
    navigation?: DetailNavigation | null;
    onClose?: () => void;
};

const iconButton = cn(
    appBarIconButton,
    'size-11 hover:bg-surface-2 disabled:opacity-40',
);

const STATUS_TONES = {
    backlog: 'neutral',
    todo: 'neutral',
    in_progress: 'warning',
    review: 'info',
    done: 'success',
    canceled: 'neutral',
} as const;

/**
 * Sub-header of the task detail. Page (DTugas): back chip, mono key, status
 * and priority badges, then presence, link and menu as round buttons. Sheet:
 * J/K position, presence, full screen, link, menu and close.
 */
export function TaskDetailHeader({
    state,
    viewers,
    layout,
    navigation,
    onClose,
}: Props) {
    const { detail } = state;
    const [confirming, setConfirming] = useState(false);
    const status = detail.statuses.find(
        (item) => item.id === detail.task.status_id,
    );

    const copyLink = () => {
        void navigator.clipboard
            ?.writeText(`${window.location.origin}${detail.url}`)
            .then(() => toast.success(`Tautan ${detail.task.key} disalin.`));
    };

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-2.5',
                layout === 'sheet' &&
                    'min-h-16 border-b border-border px-4 py-2.5',
            )}
        >
            {layout === 'page' ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <Link
                        href={`/w/${detail.workspace.key}`}
                        className={cn(
                            'inline-flex h-10 items-center gap-1.5 rounded-control border border-border bg-surface pr-3.5 pl-2.5 text-[15px] font-semibold text-text transition-colors duration-120 ease-brand hover:bg-surface-2',
                            focusRing,
                        )}
                    >
                        <ChevronLeft className="size-[18px]" aria-hidden />
                        {detail.workspace.type === 'personal'
                            ? 'Pribadi'
                            : 'Board'}
                    </Link>
                    <span className="inline-flex h-10 items-center rounded-control bg-surface-2 px-3 font-mono text-[15px] font-semibold text-text">
                        {detail.task.key}
                    </span>
                    {status && (
                        <Badge
                            variant="status"
                            tone={STATUS_TONES[status.category]}
                            className="h-10"
                        >
                            <StatusIcon
                                category={status.category}
                                color={status.color}
                            />
                            {status.name}
                        </Badge>
                    )}
                    {detail.task.priority !== 0 && (
                        <Badge
                            variant="status"
                            tone={
                                detail.task.priority === 1
                                    ? 'danger'
                                    : 'neutral'
                            }
                            className="h-10"
                        >
                            <PriorityIcon
                                priority={detail.task.priority}
                                labelled={false}
                            />
                            <span className="sr-only">Prioritas: </span>
                            {PRIORITY_LABELS[detail.task.priority]}
                        </Badge>
                    )}
                </div>
            ) : navigation ? (
                <div className="flex items-center gap-1.5 text-meta text-text-muted">
                    <button
                        type="button"
                        className={cn(iconButton, 'border-transparent')}
                        onClick={navigation.onPrevious ?? undefined}
                        disabled={!navigation.onPrevious}
                        aria-label="Tugas sebelumnya (K)"
                        title="Tugas sebelumnya (K)"
                    >
                        <ChevronUp className="size-5" aria-hidden />
                    </button>
                    <button
                        type="button"
                        className={cn(iconButton, 'border-transparent')}
                        onClick={navigation.onNext ?? undefined}
                        disabled={!navigation.onNext}
                        aria-label="Tugas berikutnya (J)"
                        title="Tugas berikutnya (J)"
                    >
                        <ChevronDown className="size-5" aria-hidden />
                    </button>
                    <span className="ml-1 tnum">
                        {formatNumber(navigation.index + 1)} dari{' '}
                        {formatNumber(navigation.total)}
                        {status && ` · ${status.name}`}
                    </span>
                </div>
            ) : (
                <span className="font-mono text-[15px] font-semibold text-text-muted">
                    {detail.task.key}
                </span>
            )}

            <div className="ml-auto flex items-center gap-2">
                <PresenceBadge people={viewers} compact={layout === 'sheet'} />
                {layout === 'sheet' && (
                    <Link
                        href={detail.url}
                        className={iconButton}
                        aria-label="Buka layar penuh"
                        title="Buka layar penuh"
                    >
                        <Maximize2 className="size-5" aria-hidden />
                    </Link>
                )}
                <button
                    type="button"
                    className={iconButton}
                    onClick={copyLink}
                    aria-label="Salin tautan"
                    title="Salin tautan"
                >
                    <Link2 className="size-5" aria-hidden />
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={iconButton}
                            aria-label="Menu tugas"
                        >
                            <MoreHorizontal className="size-5" aria-hidden />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                            onSelect={() => void state.toggleWatch()}
                        >
                            {detail.watching ? (
                                <EyeOff aria-hidden />
                            ) : (
                                <Eye aria-hidden />
                            )}
                            {detail.watching ? 'Berhenti amati' : 'Amati tugas'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={copyLink}>
                            <Link2 aria-hidden />
                            Salin tautan
                        </DropdownMenuItem>
                        {detail.can.delete && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setConfirming(true)}
                                >
                                    <Trash2 aria-hidden />
                                    Hapus tugas
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                {onClose && (
                    <button
                        type="button"
                        className={iconButton}
                        onClick={onClose}
                        aria-label="Tutup (Esc)"
                        title="Tutup (Esc)"
                    >
                        <X className="size-5" aria-hidden />
                    </button>
                )}
            </div>

            {confirming && (
                <div
                    role="alertdialog"
                    aria-label="Hapus tugas"
                    className="absolute inset-x-4 top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-danger/40 bg-surface p-3 text-[15px] shadow-float"
                >
                    <span className="mr-auto text-text">
                        Hapus {detail.task.key} “{detail.task.title}”?
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            setConfirming(false);
                            void state.deleteTask();
                        }}
                    >
                        Hapus
                    </Button>
                </div>
            )}
        </div>
    );
}
