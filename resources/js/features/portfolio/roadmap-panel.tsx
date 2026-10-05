import { Link } from '@inertiajs/react';
import { CalendarRange } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Panel } from '@/components/ui/panel';
import { cn, focusRing } from '@/lib/utils';
import { summary } from '@/routes/projects';
import { HEALTH_TONES, positionPercent, shortDay } from './lib';
import type { Roadmap } from './types';

const MILESTONE_MARK: Record<string, string> = {
    completed: 'bg-text-muted border-text-muted',
    completed_late: 'bg-text-muted border-text-muted',
    missed: 'bg-fill-danger border-fill-danger',
    in_progress: 'bg-surface border-text',
    not_started: 'bg-surface border-text',
};

const LEGEND = [
    { label: 'Sudah berjalan', mark: 'h-2.5 w-5 rounded-xs bg-text-muted/60' },
    {
        label: 'Sisa durasi',
        mark: 'h-2.5 w-5 rounded-xs border border-text-muted/60',
    },
    { label: 'Milestone selesai', mark: 'size-2.5 rotate-45 bg-text-muted' },
    { label: 'Akan datang', mark: 'size-2.5 rotate-45 border border-text' },
    { label: 'Terlewat', mark: 'size-2.5 rotate-45 bg-fill-danger' },
];

/** "Linimasa" (Agu–Des): project bars, milestones and the today line. */
export function RoadmapPanel({ roadmap }: { roadmap: Roadmap }) {
    const { from, to, today } = roadmap;
    const todayLeft = positionPercent(today, from, to);
    const range = `${roadmap.months[0]?.label ?? ''} – ${roadmap.months[roadmap.months.length - 1]?.label ?? ''} ${to.slice(0, 4)}`;

    return (
        <Panel
            title={
                <>
                    Linimasa
                    <span className="text-label font-normal text-text-muted">
                        {range}
                    </span>
                </>
            }
            action={
                <ul className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-meta font-normal text-text-muted xl:flex">
                    {LEGEND.map((item) => (
                        <li
                            key={item.label}
                            className="flex items-center gap-2"
                        >
                            <span aria-hidden className={item.mark} />
                            {item.label}
                        </li>
                    ))}
                </ul>
            }
            flush
            className="pb-4"
        >
            {roadmap.rows.length === 0 ? (
                <div className="px-6 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={CalendarRange}
                        title="Belum ada proyek dengan jadwal"
                    />
                </div>
            ) : (
                <div className="overflow-x-auto px-6 pt-1 md:px-7">
                    <div className="grid min-w-[880px] grid-cols-[260px_minmax(0,1fr)]">
                        <div />
                        <div className="relative h-10 border-b border-border text-meta text-text-muted">
                            {roadmap.months.map((month) => (
                                <span
                                    key={month.start}
                                    className="absolute top-2.5 border-l border-border pl-2"
                                    style={{
                                        left: `${positionPercent(month.start, from, to)}%`,
                                    }}
                                >
                                    {month.label}
                                </span>
                            ))}
                            <span
                                className="absolute top-1.5 z-10 -translate-x-1/2 rounded-sm bg-grad-aksi px-2 py-0.5 text-[13px] font-bold whitespace-nowrap text-on-brand"
                                style={{ left: `${todayLeft}%` }}
                            >
                                Hari ini {shortDay(today)}
                            </span>
                        </div>
                        {roadmap.rows.map((row) => {
                            const tone = row.health
                                ? HEALTH_TONES[row.health]
                                : null;
                            const start = row.start_date ?? today;
                            const end = row.target_date ?? today;
                            const left = positionPercent(start, from, to);
                            const right = positionPercent(end, from, to);
                            const elapsed = Math.min(right, todayLeft);

                            return (
                                <div key={row.id} className="contents">
                                    <Link
                                        href={summary.url(row.key)}
                                        prefetch
                                        className={cn(
                                            'flex h-12 items-center gap-2.5 border-b border-divider pr-3 text-[15px] hover:underline',
                                            focusRing,
                                        )}
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'size-2.5 shrink-0 rounded-full',
                                                tone?.dot ?? 'bg-text-subtle',
                                            )}
                                        />
                                        <span className="w-11 shrink-0 font-mono text-[13px] font-semibold text-text-muted">
                                            {row.key}
                                        </span>
                                        <span className="truncate font-semibold">
                                            {row.name}
                                        </span>
                                    </Link>
                                    <div className="relative h-12 border-b border-divider">
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-0 z-0 w-0.5 bg-primary/70"
                                            style={{ left: `${todayLeft}%` }}
                                        />
                                        <span
                                            className={cn(
                                                'absolute top-[18px] h-3 rounded-xs border',
                                                tone?.track ??
                                                    'border-border-strong',
                                            )}
                                            style={{
                                                left: `${left}%`,
                                                width: `${Math.max(0.5, right - left)}%`,
                                            }}
                                        />
                                        {elapsed > left && (
                                            <span
                                                className={cn(
                                                    'absolute top-[18px] h-3 rounded-l-xs opacity-80',
                                                    tone?.bar ??
                                                        'bg-text-subtle',
                                                )}
                                                style={{
                                                    left: `${left}%`,
                                                    width: `${elapsed - left}%`,
                                                }}
                                            />
                                        )}
                                        {row.milestones.map((milestone) => (
                                            <span
                                                key={milestone.id}
                                                title={`${milestone.name} · ${shortDay(milestone.target_date)}`}
                                                className={cn(
                                                    'absolute top-[19px] z-10 size-2.5 -translate-x-1/2 rotate-45 border',
                                                    MILESTONE_MARK[
                                                        milestone.status
                                                    ],
                                                )}
                                                style={{
                                                    left: `${positionPercent(milestone.target_date, from, to)}%`,
                                                }}
                                            />
                                        ))}
                                        {row.target_date && (
                                            <span
                                                className="absolute top-[15px] ml-2 text-[13px] whitespace-nowrap text-text-muted"
                                                style={{ left: `${right}%` }}
                                            >
                                                {shortDay(row.target_date)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Panel>
    );
}
