import { Link, usePage } from '@inertiajs/react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { cn, focusRing } from '@/lib/utils';

/**
 * Preview-only switch between the states every screen must handle. Read
 * from `?keadaan=kosong|galat|memuat` on the client, so a link (or a typed
 * URL) shows the empty, error or loading layout with the same page.
 */
export type PreviewState = 'ready' | 'empty' | 'error' | 'loading';

const PARAM: Record<Exclude<PreviewState, 'ready'>, string> = {
    empty: 'kosong',
    error: 'galat',
    loading: 'memuat',
};

export function previewStateFromUrl(url: string): PreviewState {
    const query = url.split('?')[1] ?? '';
    const value = new URLSearchParams(query).get('keadaan');

    switch (value) {
        case 'kosong':
            return 'empty';
        case 'galat':
            return 'error';
        case 'memuat':
            return 'loading';
        default:
            return 'ready';
    }
}

export function usePreviewState(): { state: PreviewState; path: string } {
    const { url } = usePage();

    return { state: previewStateFromUrl(url), path: url.split('?')[0] };
}

const OPTIONS: { value: PreviewState; label: string }[] = [
    { value: 'ready', label: 'Berisi' },
    { value: 'empty', label: 'Kosong' },
    { value: 'error', label: 'Galat' },
    { value: 'loading', label: 'Memuat' },
];

/**
 * Prototype banner + small links to look at the other states. Sits once at
 * the top of every F2-4 screen.
 */
export function PreviewBar({ className }: { className?: string }) {
    const { state, path } = usePreviewState();

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-2',
                className,
            )}
        >
            <PrototypeBanner phase="Fase 2" />
            <nav
                aria-label="Keadaan contoh"
                className="flex flex-wrap items-center gap-1"
            >
                <span className="mr-1 text-meta text-text-muted">
                    Lihat keadaan:
                </span>
                {OPTIONS.map((option) => {
                    const href =
                        option.value === 'ready'
                            ? path
                            : `${path}?keadaan=${PARAM[option.value]}`;
                    const current = option.value === state;

                    return (
                        <Link
                            key={option.value}
                            href={href}
                            preserveScroll
                            aria-current={current ? 'page' : undefined}
                            className={cn(
                                'inline-flex min-h-control items-center rounded-control px-2.5 text-meta font-semibold transition-colors duration-120 ease-brand md:min-h-control-sm',
                                current
                                    ? 'bg-surface-2 text-text'
                                    : 'text-link hover:bg-link-soft',
                                focusRing,
                            )}
                        >
                            {option.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

/** Error panel with a retry link back to the filled state. */
export function PreviewError({ what }: { what: string }) {
    const { path } = usePreviewState();

    return (
        <EmptyState
            icon={AlertTriangle}
            title={`${what} tidak bisa dimuat`}
            description="Server tidak menjawab. Periksa koneksi lalu coba lagi."
            action={
                <Button variant="outline" asChild>
                    <Link href={path} preserveScroll>
                        <RotateCcw aria-hidden />
                        Coba lagi
                    </Link>
                </Button>
            }
        />
    );
}

/** Generic page skeleton: header row, KPI row and two panels. */
export function PreviewSkeleton({ kpis = 0 }: { kpis?: number }) {
    return (
        <div className="flex flex-col gap-5" aria-busy aria-label="Memuat">
            <Skeleton className="hidden h-12 w-72 md:block" />
            {kpis > 0 && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                    {Array.from({ length: kpis }, (_, index) => (
                        <Skeleton key={index} className="h-32 rounded-card" />
                    ))}
                </div>
            )}
            <div className="flex flex-col gap-5 lg:flex-row">
                <Skeleton className="h-96 rounded-panel lg:flex-[1.5]" />
                <Skeleton className="h-72 rounded-panel lg:flex-1" />
            </div>
        </div>
    );
}

/**
 * Desktop/tablet page heading (the phone shows the title in its app bar):
 * h1 in the display scale, a muted line under it, actions on the right.
 */
export function PageHeading({
    title,
    description,
    actions,
}: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <section className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1 md:gap-2">
                <h1 className="hidden text-display tracking-[-0.03em] text-text md:block">
                    {title}
                </h1>
                {description && (
                    <p className="text-[15px] leading-[22px] text-text-muted md:text-body-lg">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-3">
                    {actions}
                </div>
            )}
        </section>
    );
}
