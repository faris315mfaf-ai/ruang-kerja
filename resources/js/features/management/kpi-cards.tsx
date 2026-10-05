import { cn } from '@/lib/utils';
import type { KpiCard, KpiTone } from './lib';
import { ArusSkeleton } from './panel';

const TONES: Record<KpiTone, { card: string; sub: string }> = {
    highlight: {
        card: 'bg-arus-highlight text-arus-on-gradient shadow-arus-action',
        sub: 'text-arus-on-gradient',
    },
    warm: {
        card: 'bg-arus-warm text-arus-on-gradient shadow-arus-warm',
        sub: 'text-arus-on-gradient',
    },
    plain: {
        card: 'border border-arus-border bg-arus-surface text-arus-text shadow-arus-card',
        sub: 'text-arus-text-2',
    },
};

/** One KPI card (design: 22px radius, 42px value; gradient for highlight/warm). */
export function KpiCardView({ card }: { card: KpiCard }) {
    const tone = TONES[card.tone];

    return (
        <div
            className={cn(
                'flex min-w-0 flex-[1_1_230px] flex-col gap-2 rounded-arus-card p-6',
                tone.card,
            )}
        >
            <span className={cn('text-[16px] font-semibold', tone.sub)}>
                {card.label}
            </span>
            <span className="text-[42px] leading-[50px] font-bold tracking-[-0.02em]">
                {card.value}
            </span>
            <span className={cn('text-[15px] leading-[22px]', tone.sub)}>
                {card.note}
            </span>
        </div>
    );
}

export function KpiCardSkeleton({ tone }: { tone: KpiTone }) {
    return (
        <div
            aria-hidden
            className={cn(
                'flex min-w-0 flex-[1_1_230px] flex-col gap-3 rounded-arus-card p-6',
                TONES[tone].card,
            )}
        >
            <ArusSkeleton className="h-5 w-28 opacity-60" />
            <ArusSkeleton className="h-11 w-24 opacity-60" />
            <ArusSkeleton className="h-4 w-40 opacity-60" />
        </div>
    );
}
