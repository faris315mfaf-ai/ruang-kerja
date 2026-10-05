import { categoryClass, statusTone, toneClass } from '@/lib/requests';
import type { Tone } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { LeaveTypeInfo, RequestStatus } from '@/types/requests';

export function CategoryBadge({
    type,
    className,
}: {
    type: Pick<LeaveTypeInfo, 'name' | 'category'>;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap',
                categoryClass[type.category],
                className,
            )}
        >
            {type.name}
        </span>
    );
}

/** Dot + text (status is never color only — DESIGN.md §1). */
export function TonePill({
    tone,
    children,
    className,
}: {
    tone: Tone;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
                toneClass[tone].pill,
                className,
            )}
        >
            <span
                aria-hidden
                className={cn('size-1.5 rounded-full', toneClass[tone].dot)}
            />
            {children}
        </span>
    );
}

export function StatusBadge({
    status,
    label,
    suffix,
    className,
}: {
    status: RequestStatus;
    label: string;
    suffix?: string | null;
    className?: string;
}) {
    return (
        <TonePill tone={statusTone[status]} className={className}>
            {label}
            {suffix ? ` · ${suffix}` : ''}
        </TonePill>
    );
}
