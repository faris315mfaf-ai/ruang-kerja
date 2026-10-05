import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type KpiDelta = {
    text: string;
    tone: 'success' | 'danger' | 'neutral';
    direction?: 'up' | 'down' | 'flat';
};

const TONES = {
    /** White card, border, e-1 ("Tingkat penyelesaian"). */
    plain: {
        card: 'border border-border bg-surface text-text shadow-card',
        sub: 'text-text-muted',
    },
    /** Gradient aksi with a corner light ("Menunggu persetujuan Anda"). Max one per row. */
    highlight: {
        card: 'bg-primary bg-grad-highlight text-on-brand shadow-glow',
        sub: 'text-on-brand',
    },
    /** Gradient hangat for attention ("Butuh keputusan"). Max one per screen. */
    warm: {
        card: 'bg-danger bg-grad-hangat text-on-brand shadow-warm',
        sub: 'text-on-brand',
    },
} as const;

const DELTA_TONES = {
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-2 text-text-muted',
} as const;

/**
 * KPI card (Komponen / DBeranda "Ringkasan"): label 15–16 semibold, value in
 * `text-kpi` (40/48 desktop, 28 phone) with tabular numbers, delta pill and a
 * note. `bar` (progress/split bar, DHR "Hadir sekarang", DPortofolio "Proyek
 * aktif") sits between the value and the note; optional children
 * (sparkline, action) go at the bottom.
 */
export function KpiCard({
    label,
    value,
    suffix,
    note,
    delta,
    tone = 'plain',
    valueClassName,
    className,
    bar,
    children,
}: {
    label: ReactNode;
    value: ReactNode;
    /** Smaller text after the value ("/ 14", "hari"). */
    suffix?: ReactNode;
    note?: ReactNode;
    delta?: KpiDelta | null;
    tone?: keyof typeof TONES;
    /** e.g. text-danger for an alarming value on a plain card. */
    valueClassName?: string;
    className?: string;
    /** Bar between the value and the note (see {@link KpiBar}). */
    bar?: ReactNode;
    children?: ReactNode;
}) {
    const style = TONES[tone];
    const Arrow =
        delta?.direction === 'up'
            ? ArrowUp
            : delta?.direction === 'down'
              ? ArrowDown
              : Minus;

    return (
        <section
            className={cn(
                'flex min-w-0 flex-col gap-2 rounded-card px-6 py-[22px]',
                style.card,
                className,
            )}
        >
            <h3 className={cn('text-[15px] leading-[22px] font-semibold', style.sub)}>
                {label}
            </h3>
            <p className={cn('text-kpi tnum', valueClassName)}>
                {value}
                {suffix && (
                    <span className="text-[0.55em] font-semibold tracking-normal">
                        {' '}
                        {suffix}
                    </span>
                )}
            </p>
            {bar}
            {(delta || note) && (
                <p
                    className={cn(
                        'flex flex-wrap items-center gap-1.5 text-[15px] leading-[22px]',
                        style.sub,
                    )}
                >
                    {delta && (
                        <span
                            className={cn(
                                'inline-flex h-[26px] items-center gap-1 rounded-full px-2.5 font-bold',
                                tone === 'plain'
                                    ? DELTA_TONES[delta.tone]
                                    : 'bg-on-brand/18 text-on-brand',
                            )}
                        >
                            <Arrow
                                aria-hidden
                                className="size-3.5"
                                strokeWidth={2.6}
                            />
                            {delta.text}
                        </span>
                    )}
                    {note}
                </p>
            )}
            {children}
        </section>
    );
}

/**
 * 8px progress bar for a KPI card: white on the highlight/warm gradients
 * (DHR "Hadir sekarang"), teal on a plain card.
 */
export function KpiBar({
    value,
    label,
    onBrand = true,
    className,
}: {
    /** 0–100. */
    value: number;
    /** Accessible name ("Hadir dari yang terjadwal"). */
    label: string;
    onBrand?: boolean;
    className?: string;
}) {
    const clamped = Math.max(0, Math.min(100, value));

    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped)}
            className={cn(
                'h-2 overflow-hidden rounded-full',
                onBrand ? 'bg-on-brand/25' : 'bg-surface-2',
                className,
            )}
        >
            <div
                className={cn(
                    'h-full rounded-full',
                    onBrand ? 'bg-on-brand' : 'bg-primary',
                )}
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
}
