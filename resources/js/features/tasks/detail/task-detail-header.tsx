import { Link } from '@inertiajs/react';
import {
    ChevronDown,
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
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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

const iconButton =
    'flex size-8 items-center justify-center rounded-md border border-border text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40';

/** Sub-header of the task detail: position, presence, link, full screen, menu. */
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
        <div className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
            {navigation ? (
                <div className="flex items-center gap-1 text-[13px] text-text-muted">
                    <button
                        type="button"
                        className={cn(iconButton, 'border-transparent')}
                        onClick={navigation.onPrevious ?? undefined}
                        disabled={!navigation.onPrevious}
                        aria-label="Tugas sebelumnya (K)"
                        title="Tugas sebelumnya (K)"
                    >
                        <ChevronUp className="size-4" aria-hidden />
                    </button>
                    <button
                        type="button"
                        className={cn(iconButton, 'border-transparent')}
                        onClick={navigation.onNext ?? undefined}
                        disabled={!navigation.onNext}
                        aria-label="Tugas berikutnya (J)"
                        title="Tugas berikutnya (J)"
                    >
                        <ChevronDown className="size-4" aria-hidden />
                    </button>
                    <span className="ml-1 tnum">
                        {formatNumber(navigation.index + 1)} dari{' '}
                        {formatNumber(navigation.total)}
                        {status && ` · ${status.name}`}
                    </span>
                </div>
            ) : (
                <span className="font-mono text-[13px] text-text-muted">
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
                        <Maximize2 className="size-4" aria-hidden />
                    </Link>
                )}
                <button
                    type="button"
                    className={iconButton}
                    onClick={copyLink}
                    aria-label="Salin tautan"
                    title="Salin tautan"
                >
                    <Link2 className="size-4" aria-hidden />
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={iconButton}
                            aria-label="Menu tugas"
                        >
                            <MoreHorizontal className="size-4" aria-hidden />
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
                        <X className="size-4" aria-hidden />
                    </button>
                )}
            </div>

            {confirming && (
                <div
                    role="alertdialog"
                    aria-label="Hapus tugas"
                    className="absolute inset-x-4 top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-danger/40 bg-surface p-3 text-[13px] shadow-card"
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
