import { Link } from '@inertiajs/react';
import type { ComponentProps, ReactNode } from 'react';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, focusRing } from '@/lib/utils';
import type { MetricDefinition } from '@/types/dashboard';
import { MetricInfo } from './metric-info';

type KpiProps = ComponentProps<typeof KpiCard>;

/**
 * Dashboard KPI = Arus `KpiCard` + the metric definition tooltip (PRD M7:
 * every metric explains its formula). With `href` the whole card is a link
 * (SBeranda "Saldo cuti tahunan", "Tugas terbuka").
 */
export function MetricKpi({
    label,
    definition,
    href,
    linkLabel,
    className,
    cardClassName,
    ...props
}: Omit<KpiProps, 'label'> & {
    /** Card styling (padding, radius); `className` is for layout. */
    cardClassName?: string;
    label: string;
    definition?: Pick<MetricDefinition, 'label' | 'definition'> | string;
    href?: string;
    /** Accessible name of the link when the card is one. */
    linkLabel?: string;
}) {
    const card = (
        <KpiCard
            {...props}
            className={cn(href ? 'h-full' : className, cardClassName)}
            label={
                <span className="flex items-start justify-between gap-2">
                    {label}
                    {definition && (
                        <MetricInfo
                            definition={definition}
                            className="mt-[3px]"
                        />
                    )}
                </span>
            }
        />
    );

    if (!href) {
        return card;
    }

    return (
        <Link
            href={href}
            prefetch
            aria-label={linkLabel}
            className={cn(
                'block min-w-0 rounded-card transition-transform duration-120 ease-brand hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                focusRing,
                className,
            )}
        >
            {card}
        </Link>
    );
}

/** Placeholder of a plain KPI card while deferred metrics load. */
export function KpiSkeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface px-6 py-[22px] shadow-card',
                className,
            )}
        >
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-11 w-24" />
            <Skeleton className="h-4 w-40" />
        </div>
    );
}

/** Arus `Panel` with skeleton rows (deferred panels). */
export function PanelSkeleton({
    title,
    className,
    rows = 4,
}: {
    title: ReactNode;
    className?: string;
    rows?: number;
}) {
    return (
        <Panel title={title} className={className} bodyClassName="gap-3">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
            ))}
        </Panel>
    );
}

/** Small muted text on the right of a panel header ("tenggat per hari"). */
export function PanelHint({ children }: { children: ReactNode }) {
    return <span className="text-meta text-text-muted">{children}</span>;
}

/** Page header (SBeranda / DBeranda): overline, h1 44px, subtitle. */
export function PageHeader({
    overline,
    title,
    subtitle,
    children,
}: {
    overline?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    /** Right side (view picker, actions). */
    children?: ReactNode;
}) {
    return (
        <section className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex min-w-0 flex-col gap-2">
                {overline && (
                    <span className="text-overline text-link">{overline}</span>
                )}
                <h1 className="text-display">{title}</h1>
                {subtitle && (
                    <p className="text-body-lg text-text-muted">{subtitle}</p>
                )}
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-3">
                    {children}
                </div>
            )}
        </section>
    );
}

/**
 * Phone section title above a card (MSBeranda "Fokus hari ini · Semua"):
 * 22px h2 with an optional teal link (44px hit area).
 */
export function SectionHeader({
    id,
    title,
    href,
    link,
    linkLabel,
}: {
    id?: string;
    title: ReactNode;
    href?: string;
    link?: ReactNode;
    linkLabel?: string;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3 px-1 pt-1">
            <h2 id={id} className="text-h2">
                {title}
            </h2>
            {href && link && (
                <Link
                    href={href}
                    prefetch
                    aria-label={linkLabel}
                    className={cn(
                        '-my-2 inline-flex min-h-11 items-center rounded-control px-1 text-[16px] font-semibold text-link',
                        focusRing,
                    )}
                >
                    {link}
                </Link>
            )}
        </div>
    );
}

/** Phone card that holds list rows (MSBeranda: radius 22, border, no shadow). */
export function MobileCard({
    children,
    className,
    ...props
}: ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-[22px] border border-border bg-surface',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}
