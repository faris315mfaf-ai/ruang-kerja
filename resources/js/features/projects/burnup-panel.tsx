import { TrendingUp } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { shortDay } from '@/features/portfolio/lib';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import { cn } from '@/lib/utils';
import { BurnupChart, burnupCaption } from './burnup-chart';

const LEGEND = [
    { label: 'Lingkup', swatch: 'h-[3px] rounded-[2px] bg-text-subtle' },
    { label: 'Selesai', swatch: 'h-1 rounded-[2px] bg-grad-merek-x' },
    { label: 'Ideal', swatch: 'h-0 border-t-2 border-dashed border-marker' },
    {
        label: 'Proyeksi',
        swatch: 'h-0 border-t-2 border-dotted border-accent-blue-strong',
    },
];

/** Burn-up panel (DProyek): title, legend, chart and the reading below. */
export function BurnupPanel({
    props,
    compact = false,
}: {
    props: ProjectSummaryProps;
    compact?: boolean;
}) {
    const caption = burnupCaption(
        props.burnup,
        shortDay(props.project.target_date),
    );
    const unit = props.project.metrics.uses_estimates
        ? 'Jam estimasi'
        : 'Jumlah tugas';

    return (
        <Panel
            title={compact ? 'Burn-up mingguan' : 'Burn-up'}
            action={
                <ul
                    className={cn(
                        'flex flex-wrap gap-x-4 gap-y-1 text-label font-normal text-text-muted',
                        compact && 'w-full text-meta',
                    )}
                >
                    {LEGEND.map((item) => (
                        <li
                            key={item.label}
                            className="inline-flex items-center gap-2"
                        >
                            <span
                                aria-hidden
                                className={cn('w-[18px]', item.swatch)}
                            />
                            {item.label}
                        </li>
                    ))}
                </ul>
            }
            bodyClassName="gap-4"
        >
            {!compact && (
                <p className="-mt-2 text-label font-normal text-text-muted">
                    {unit}: lingkup, selesai, dan garis ideal sampai target
                </p>
            )}
            <BurnupChart
                burnup={props.burnup}
                height={compact ? 200 : 280}
                compact={compact}
            />
            {caption && (
                <p className="flex gap-3 rounded-lg bg-info-soft px-4 py-3.5 text-body text-info">
                    <TrendingUp
                        aria-hidden
                        className="mt-0.5 size-[22px] shrink-0"
                    />
                    <span>{caption}</span>
                </p>
            )}
        </Panel>
    );
}
