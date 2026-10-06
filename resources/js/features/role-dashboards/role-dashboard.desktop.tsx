import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { greeting } from '@/features/dashboard/lib';
import { cn, focusRing } from '@/lib/utils';
import {
    BAR_TONE,
    firstName,
    formatKpiValue,
    kpiSuffix,
    scheduleDay,
    TEXT_CLASSES,
} from './lib';
import {
    ActionLink,
    HeldCard,
    KindChip,
    PanelEmpty,
    RoleListRow,
} from './parts';
import type { RoleAction, RoleDashboard, RoleRow } from './types';

/** Primary/secondary header button: opens the flow or follows a link. */
function ActionButton({
    action,
    primary,
    onFlow,
}: {
    action: RoleAction;
    primary: boolean;
    onFlow: () => void;
}) {
    const props = primary
        ? ({ size: 'lg' } as const)
        : ({ variant: 'outline' } as const);

    if (action.flow || !action.href) {
        return (
            <Button {...props} onClick={onFlow}>
                {action.label}
            </Button>
        );
    }

    return (
        <Button {...props} asChild>
            <Link href={action.href}>{action.label}</Link>
        </Button>
    );
}

/** Desktop/tablet dashboard of one job (RoleDesk / Peran*). */
export function RoleDashboardDesktop({
    config,
    viewerName,
    onOpenFlow,
}: {
    config: RoleDashboard;
    viewerName: string;
    onOpenFlow: (row?: RoleRow) => void;
}) {
    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-wrap items-end justify-between gap-5">
                <div className="flex min-w-0 flex-col gap-2">
                    <span className="inline-flex h-8 w-fit items-center rounded-full border border-border bg-surface/75 px-3 text-[14px] font-extrabold text-link">
                        {config.label} · {config.unit}
                    </span>
                    <h1 className="text-display">
                        {greeting()}, {firstName(viewerName)}
                    </h1>
                    <span className="text-body-lg text-text-muted">
                        {config.subtitle}
                    </span>
                </div>
                <div className="flex flex-wrap gap-3">
                    {config.secondary && (
                        <ActionButton
                            action={config.secondary}
                            primary={false}
                            onFlow={() => onOpenFlow()}
                        />
                    )}
                    {config.primary && (
                        <ActionButton
                            action={config.primary}
                            primary
                            onFlow={() => onOpenFlow()}
                        />
                    )}
                </div>
            </section>

            <section
                aria-label="Ringkasan"
                className="grid grid-cols-2 gap-5 xl:grid-cols-4"
            >
                {config.kpis.map((kpi) => (
                    <KpiCard
                        key={kpi.label}
                        label={kpi.label}
                        value={formatKpiValue(kpi)}
                        suffix={kpiSuffix(kpi)}
                        note={kpi.note}
                        tone={kpi.tone}
                    />
                ))}
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                    <Panel
                        flush
                        title={config.list.title}
                        action={
                            <ActionLink
                                action={config.list.link}
                                onFlow={() => onOpenFlow()}
                            />
                        }
                        className="pb-2"
                    >
                        {config.list.rows.length === 0 ? (
                            <div className="px-6 pb-4 md:px-7">
                                <PanelEmpty title="Tidak ada yang menunggu">
                                    {config.list.empty}
                                </PanelEmpty>
                            </div>
                        ) : (
                            <ul className="divide-y divide-divider border-t border-divider">
                                {config.list.rows.map((row) => (
                                    <li key={row.id}>
                                        <RoleListRow
                                            row={row}
                                            onOpen={onOpenFlow}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel
                        title={config.bars.title}
                        action={
                            <span className="text-[15px] text-text-muted">
                                {config.bars.note}
                            </span>
                        }
                    >
                        {config.bars.items.length === 0 ? (
                            <PanelEmpty title={config.bars.empty} />
                        ) : (
                            <ul className="flex flex-col gap-4">
                                {config.bars.items.map((item) => {
                                    const name = (
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-[16px] font-bold">
                                                {item.name}
                                            </span>
                                            <span className="truncate text-[14px] text-text-muted">
                                                {item.sub}
                                            </span>
                                        </span>
                                    );

                                    return (
                                        <li
                                            key={item.id}
                                            className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,200px)_1fr_140px] lg:grid-cols-[minmax(0,240px)_1fr_160px]"
                                        >
                                            {item.href ? (
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        'min-w-0 rounded-sm hover:underline',
                                                        focusRing,
                                                    )}
                                                >
                                                    {name}
                                                </Link>
                                            ) : (
                                                name
                                            )}
                                            <Progress
                                                size="lg"
                                                value={item.value}
                                                marker={item.plan ?? undefined}
                                                tone={BAR_TONE[item.tone]}
                                                label={`${item.name}: ${item.note}`}
                                            />
                                            <span
                                                className={cn(
                                                    'text-[15px] font-bold md:text-right',
                                                    TEXT_CLASSES[item.tone],
                                                )}
                                            >
                                                {item.note}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="grid min-w-0 items-start gap-5 md:grid-cols-2 xl:grid-cols-1">
                    {config.held && <HeldCard held={config.held} />}

                    <Panel
                        title={config.schedule.title}
                        action={<ActionLink action={config.schedule.link} />}
                    >
                        {config.schedule.items.length === 0 ? (
                            <PanelEmpty title={config.schedule.empty} />
                        ) : (
                            <ul className="flex flex-col">
                                {config.schedule.items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex gap-3.5 border-t border-divider py-3 first:border-t-0"
                                    >
                                        <span className="w-[96px] shrink-0 pt-0.5 text-[14px] font-extrabold whitespace-nowrap">
                                            {scheduleDay(item.date)}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            {item.href ? (
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        'rounded-sm text-[16px] font-bold hover:underline',
                                                        focusRing,
                                                    )}
                                                >
                                                    {item.title}
                                                </Link>
                                            ) : (
                                                <span className="text-[16px] font-bold">
                                                    {item.title}
                                                </span>
                                            )}
                                            <span className="flex flex-wrap items-center gap-1.5 text-[14px] text-text-muted">
                                                <KindChip kind={item.kind} />
                                                {item.meta}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <SidePanel config={config} />
                </div>
            </div>
        </div>
    );
}

function SidePanel({ config }: { config: RoleDashboard }) {
    const warm = config.side.warm && config.side.items.length > 0;

    return (
        <section
            aria-label={config.side.title}
            className={cn(
                'flex flex-col gap-1 rounded-panel p-6',
                warm
                    ? 'bg-grad-hangat text-on-brand shadow-warm'
                    : 'border border-border bg-surface shadow-card',
            )}
        >
            <h2 className="mb-2 text-[20px] leading-7 font-bold md:text-[22px]">
                {config.side.title}
            </h2>
            {config.side.items.length === 0 ? (
                <p className="text-[15px] text-text-muted">
                    {config.side.empty}
                </p>
            ) : (
                <ul className="flex flex-col">
                    {config.side.items.map((item) => (
                        <li
                            key={item.title}
                            className={cn(
                                'flex flex-col gap-0.5 border-t py-3',
                                warm ? 'border-on-brand/28' : 'border-divider',
                            )}
                        >
                            {item.href ? (
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'rounded-sm text-[16px] font-bold hover:underline',
                                        focusRing,
                                    )}
                                >
                                    {item.title}
                                </Link>
                            ) : (
                                <span className="text-[16px] font-bold">
                                    {item.title}
                                </span>
                            )}
                            <span
                                className={cn(
                                    'text-[14px] leading-5',
                                    warm ? 'text-on-brand' : 'text-text-muted',
                                )}
                            >
                                {item.meta}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
