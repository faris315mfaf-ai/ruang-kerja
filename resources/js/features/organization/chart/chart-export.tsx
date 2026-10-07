import { Download, Loader2, MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MAX_CANVAS_AREA } from './export-utils';
import type { OrgChart } from './types';

/*
 * The page owns the (filtered) chart; the phone app bar is rendered by the
 * layout. A tiny store connects the two: the page registers how to export,
 * the app bar menu triggers it and shows the progress.
 */
type ExportState = { available: boolean; busy: boolean };

let state: ExportState = { available: false, busy: false };
let runner: (() => void) | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<ExportState>): void {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function useExportState(): ExportState {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => state,
    );
}

/** Phones and tablets (touch) get the iOS-safe canvas budget. */
function canvasBudget(): number {
    return navigator.maxTouchPoints > 0 ||
        window.matchMedia('(max-width: 767px)').matches
        ? MAX_CANVAS_AREA.mobile
        : MAX_CANVAS_AREA.desktop;
}

/**
 * "Unduh PNG" for the org chart: exports `chart` (already filtered by the
 * search) with toasts for success, reduced resolution and failure.
 */
export function useChartExport({
    chart,
    query,
    enabled,
}: {
    chart: OrgChart;
    query: string;
    enabled: boolean;
}) {
    const { busy } = useExportState();

    const run = useCallback(async () => {
        if (state.busy) {
            return;
        }

        update({ busy: true });

        try {
            const { exportChartPng } = await import('./export-chart-png');
            const { fileName, size } = await exportChartPng({
                chart,
                query,
                maxArea: canvasBudget(),
            });

            if (size.capped) {
                toast.warning('PNG diunduh dengan resolusi lebih rendah', {
                    description:
                        'Bagan terlalu besar untuk resolusi penuh. Persempit dengan pencarian bila teks kurang tajam.',
                });
            } else {
                toast.success('PNG struktur organisasi diunduh', {
                    description: fileName,
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('Gagal membuat PNG struktur organisasi', {
                description:
                    'Coba lagi. Bila bagan sangat besar, persempit dengan pencarian.',
            });
        } finally {
            update({ busy: false });
        }
    }, [chart, query]);

    useEffect(() => {
        const start = () => void run();

        runner = start;
        update({ available: enabled });

        return () => {
            if (runner === start) {
                runner = null;
            }

            update({ available: false });
        };
    }, [run, enabled]);

    return { run, busy };
}

/** Desktop/tablet header button next to the view switch. */
export function ChartExportButton({
    busy,
    disabled = false,
    onClick,
}: {
    busy: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="outline"
            onClick={onClick}
            disabled={busy || disabled}
            aria-busy={busy}
        >
            {busy ? (
                <Loader2 className="animate-spin" aria-hidden />
            ) : (
                <Download aria-hidden />
            )}
            {busy ? 'Menyiapkan PNG…' : 'Unduh PNG'}
        </Button>
    );
}

/** Phone app bar overflow ("…") of /organisasi/struktur. */
export function StructureAppBarActions() {
    const { available, busy } = useExportState();

    if (!available) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={busy ? 'Menyiapkan PNG…' : 'Aksi lainnya'}
                    aria-busy={busy}
                    disabled={busy}
                    className={cn(appBarIconButton, 'size-11')}
                >
                    {busy ? (
                        <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                        <MoreHorizontal className="size-5" aria-hidden />
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => runner?.()}
                >
                    <Download aria-hidden />
                    <span className="grid leading-tight">
                        Unduh PNG bagan
                        <span className="text-meta text-text-muted">
                            Bagan lengkap, bisa berukuran besar
                        </span>
                    </span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
