import { Panel, PanelLink } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { BAR_TONE, TEXT_CLASSES } from './lib';
import { PanelEmpty, PlaceChip, RoleListRow } from './parts';
import type { RoleDashboard } from './types';

/** Desktop/tablet dashboard of one SPKD role (RoleDesk / Peran*). */
export function RoleDashboardDesktop({
    config,
    onOpenFlow,
    onSecondary,
}: {
    config: RoleDashboard;
    onOpenFlow: () => void;
    onSecondary: () => void;
}) {
    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-wrap items-end justify-between gap-5">
                <div className="flex min-w-0 flex-col gap-2">
                    <span className="inline-flex h-8 w-fit items-center rounded-full border border-border bg-surface/75 px-3 text-[14px] font-extrabold text-link">
                        SPKD · {config.unit}
                    </span>
                    <h1 className="text-display">{config.greeting}</h1>
                    <span className="text-body-lg text-text-muted">
                        {config.title} · {config.subtitle}
                    </span>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={onSecondary}>
                        {config.secondaryAction}
                    </Button>
                    <Button size="lg" onClick={onOpenFlow}>
                        {config.primaryAction}
                    </Button>
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
                        value={kpi.value}
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
                            <span className="text-[15px] font-semibold text-text-muted">
                                {config.list.link}
                            </span>
                        }
                        className="pb-2"
                    >
                        {config.list.rows.length === 0 ? (
                            <div className="px-6 pb-4 md:px-7">
                                <PanelEmpty title="Tidak ada yang menunggu">
                                    Semua sudah ditangani. Item baru muncul di
                                    sini.
                                </PanelEmpty>
                            </div>
                        ) : (
                            <ul className="divide-y divide-divider border-t border-divider">
                                {config.list.rows.map((row, index) => (
                                    <li key={`${row.tag}-${row.title}`}>
                                        <RoleListRow
                                            row={row}
                                            onOpen={
                                                index === config.flowRow
                                                    ? onOpenFlow
                                                    : undefined
                                            }
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
                            <PanelEmpty title="Belum ada data" />
                        ) : (
                            <ul className="flex flex-col gap-4">
                                {config.bars.items.map((item) => (
                                    <li
                                        key={item.name}
                                        className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,200px)_1fr_120px] lg:grid-cols-[minmax(0,240px)_1fr_140px]"
                                    >
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-[16px] font-bold">
                                                {item.name}
                                            </span>
                                            <span className="truncate text-[14px] text-text-muted">
                                                {item.sub}
                                            </span>
                                        </span>
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
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1">
                    <Panel
                        title="Jadwal terdekat"
                        action={<PanelLink href="/rapat">Rapat</PanelLink>}
                    >
                        {config.schedule.length === 0 ? (
                            <PanelEmpty title="Tidak ada jadwal" />
                        ) : (
                            <ul className="flex flex-col">
                                {config.schedule.map((item) => (
                                    <li
                                        key={`${item.time}-${item.title}`}
                                        className="flex gap-3.5 border-t border-divider py-3"
                                    >
                                        <span className="flex w-16 shrink-0 flex-col">
                                            <span className="text-[18px] font-extrabold tnum">
                                                {item.time}
                                            </span>
                                            <span className="text-[13px] font-bold text-text-muted">
                                                {item.day}
                                            </span>
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span className="text-[16px] font-bold">
                                                {item.title}
                                            </span>
                                            <span className="flex flex-wrap items-center gap-1.5 text-[14px] text-text-muted">
                                                <PlaceChip place={item.place} />
                                                {item.meta}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <section
                        aria-label={config.side.title}
                        className={cn(
                            'flex flex-col gap-1 rounded-panel p-6',
                            config.side.warm
                                ? 'bg-grad-hangat text-on-brand shadow-warm'
                                : 'border border-border bg-surface shadow-card',
                        )}
                    >
                        <h2 className="mb-2 text-[20px] leading-7 font-bold md:text-[22px]">
                            {config.side.title}
                        </h2>
                        {config.side.items.length === 0 ? (
                            <p
                                className={cn(
                                    'text-[15px]',
                                    config.side.warm
                                        ? 'text-on-brand'
                                        : 'text-text-muted',
                                )}
                            >
                                Belum ada catatan.
                            </p>
                        ) : (
                            <ul className="flex flex-col">
                                {config.side.items.map((item) => (
                                    <li
                                        key={item.title}
                                        className={cn(
                                            'flex flex-col gap-0.5 border-t py-3',
                                            config.side.warm
                                                ? 'border-on-brand/28'
                                                : 'border-divider',
                                        )}
                                    >
                                        <span className="text-[16px] font-bold">
                                            {item.title}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-[14px] leading-5',
                                                config.side.warm
                                                    ? 'text-on-brand'
                                                    : 'text-text-muted',
                                            )}
                                        >
                                            {item.meta}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
