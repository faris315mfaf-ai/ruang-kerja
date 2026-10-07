import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useInitials } from '@/hooks/use-initials';
import { cn, focusRing } from '@/lib/utils';
import {
    firstName,
    formatKpiValue,
    kpiSuffix,
    scheduleDay,
    shortGreeting,
    TEXT_CLASSES,
    tileTone,
} from './lib';
import { HeldCard, KindChip, PanelEmpty, RoleListRow } from './parts';
import type { RoleAction, RoleDashboard, RoleRow } from './types';

const ACTION_CLASSES =
    'flex min-h-12 items-center justify-center rounded-[14px] px-2 text-center text-[15px] leading-[18px] font-extrabold transition-transform duration-120 ease-brand active:scale-[0.98] motion-reduce:active:scale-100';

/** Big phone action: opens the flow or follows a link. */
function PhoneAction({
    action,
    primary,
    onFlow,
}: {
    action: RoleAction;
    primary: boolean;
    onFlow: () => void;
}) {
    const classes = cn(
        ACTION_CLASSES,
        primary
            ? 'bg-inverse text-on-inverse'
            : 'border border-border-strong bg-surface text-text',
        focusRing,
    );

    if (action.flow || !action.href) {
        return (
            <button type="button" onClick={onFlow} className={classes}>
                {action.label}
            </button>
        );
    }

    return (
        <Link href={action.href} className={classes}>
            {action.label}
        </Link>
    );
}

/** Phone home of one job (RolePhone / PeranM*). */
export function RoleDashboardMobile({
    config,
    viewerName,
    onOpenFlow,
}: {
    config: RoleDashboard;
    viewerName: string;
    onOpenFlow: (row?: RoleRow) => void;
}) {
    const getInitials = useInitials();
    const [hero, ...rest] = config.kpis;
    const tiles = rest.slice(0, 2);
    const next = config.schedule.items[0];
    const rows = config.list.rows.slice(0, 5);
    const actions = [config.primary, config.secondary].filter(
        (action): action is RoleAction => action !== null,
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14px] font-extrabold text-link">
                        {config.label} · {config.unit}
                    </span>
                    <span className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                        {shortGreeting()}, {firstName(viewerName)}
                    </span>
                </span>
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-grad-merek text-[16px] font-extrabold text-on-brand"
                >
                    {getInitials(viewerName)}
                </span>
            </div>

            {hero && (
                <section
                    aria-label={hero.label}
                    className="flex flex-col gap-1.5 rounded-panel bg-primary bg-grad-highlight p-[18px] text-on-brand shadow-glow"
                >
                    <span className="text-[15px] font-bold">{hero.label}</span>
                    <span className="text-[40px] leading-[46px] font-extrabold tracking-[-0.02em] tnum">
                        {formatKpiValue(hero)}
                        {kpiSuffix(hero) && (
                            <span className="ml-1.5 text-[20px] font-bold">
                                {kpiSuffix(hero)}
                            </span>
                        )}
                    </span>
                    <span className="text-[15px] leading-[21px]">
                        {hero.note}
                    </span>
                </section>
            )}

            {tiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                    {tiles.map((tile) => (
                        <section
                            key={tile.label}
                            aria-label={tile.label}
                            className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-surface p-3.5"
                        >
                            <span className="text-[14px] font-semibold text-text-muted">
                                {tile.label}
                            </span>
                            <span
                                className={cn(
                                    'text-[28px] leading-[34px] font-extrabold tnum',
                                    TEXT_CLASSES[
                                        tileTone(tile.tone, tile.value)
                                    ],
                                )}
                            >
                                {formatKpiValue(tile)}
                                {kpiSuffix(tile) && (
                                    <span className="ml-1 text-[16px] font-bold text-text-muted">
                                        {kpiSuffix(tile)}
                                    </span>
                                )}
                            </span>
                            <span className="text-[13px] text-text-muted">
                                {tile.note}
                            </span>
                        </section>
                    ))}
                </div>
            )}

            {actions.length > 0 && (
                <div
                    className={cn(
                        'grid gap-2.5',
                        actions.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
                    )}
                >
                    {actions.map((action, index) => (
                        <PhoneAction
                            key={action.label}
                            action={action}
                            primary={index === 0}
                            onFlow={() => onOpenFlow()}
                        />
                    ))}
                </div>
            )}

            {config.held && <HeldCard held={config.held} compact />}

            {next && (
                <NextItem href={next.href}>
                    <span className="flex w-[88px] shrink-0 flex-col whitespace-nowrap">
                        <span className="text-[14px] font-extrabold">
                            {scheduleDay(next.date)}
                        </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-[16px] font-bold">
                            {next.title}
                        </span>
                        <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
                            <KindChip kind={next.kind} />
                            <span className="truncate">
                                {config.schedule.title.toLowerCase()}
                            </span>
                        </span>
                    </span>
                    {next.href && (
                        <ChevronRight
                            aria-hidden
                            className="size-[18px] shrink-0 text-text-subtle"
                            strokeWidth={2.4}
                        />
                    )}
                </NextItem>
            )}

            <section
                aria-label={config.list.title}
                className="rounded-[22px] border border-border bg-surface px-4 pt-3.5 pb-0.5"
            >
                <div className="flex items-baseline justify-between gap-2 pb-1.5">
                    <h2 className="text-[17px] font-extrabold">
                        {config.list.title}
                    </h2>
                    <span className="shrink-0 text-[14px] font-semibold text-text-muted">
                        {config.list.rows.length} item
                    </span>
                </div>
                {rows.length === 0 ? (
                    <div className="pb-4">
                        <PanelEmpty title="Tidak ada yang menunggu">
                            {config.list.empty}
                        </PanelEmpty>
                    </div>
                ) : (
                    <ul className="divide-y divide-divider border-t border-divider">
                        {rows.map((row) => (
                            <li key={row.id}>
                                <RoleListRow
                                    row={row}
                                    compact
                                    onOpen={onOpenFlow}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function NextItem({
    href,
    children,
}: {
    href: string | null;
    children: ReactNode;
}) {
    const classes =
        'flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 text-text';

    if (!href) {
        return <div className={classes}>{children}</div>;
    }

    return (
        <Link href={href} className={cn(classes, focusRing)}>
            {children}
        </Link>
    );
}
