import {
    Briefcase,
    CalendarDays,
    Clock,
    DoorOpen,
    FilePen,
    Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { statusTone } from '@/lib/requests';
import type { Tone } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type {
    LeaveTypeInfo,
    RequestCategory,
    RequestStatus,
} from '@/types/requests';

/** Icon + soft tint per category (SPengajuan list tiles: Cuti blue, Lembur teal, Koreksi violet, Izin amber). */
export const CATEGORY_STYLE: Record<
    RequestCategory,
    { icon: LucideIcon; tile: string }
> = {
    leave: { icon: CalendarDays, tile: 'bg-info-soft text-info' },
    permit: { icon: DoorOpen, tile: 'bg-warning-soft text-warning' },
    sick: { icon: Stethoscope, tile: 'bg-danger-soft text-danger' },
    overtime: { icon: Clock, tile: 'bg-link-soft text-link' },
    correction: {
        icon: FilePen,
        tile: 'bg-fill-violet/12 text-fill-violet',
    },
    business_trip: { icon: Briefcase, tile: 'bg-success-soft text-success' },
};

/** 48px rounded tile with the category icon (list rows, detail headers). */
export function CategoryTile({
    category,
    className,
}: {
    category: RequestCategory;
    className?: string;
}) {
    const style = CATEGORY_STYLE[category];
    const Icon = style.icon;

    return (
        <span
            aria-hidden
            className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-[14px]',
                style.tile,
                className,
            )}
        >
            <Icon className="size-6" strokeWidth={1.9} />
        </span>
    );
}

export function CategoryBadge({
    type,
    className,
}: {
    type: Pick<LeaveTypeInfo, 'name' | 'category'>;
    className?: string;
}) {
    return (
        <Badge
            variant="label"
            className={cn(CATEGORY_STYLE[type.category].tile, className)}
        >
            {type.name}
        </Badge>
    );
}

const BADGE_TONE: Record<Tone, BadgeTone> = {
    warning: 'warning',
    success: 'success',
    danger: 'danger',
    info: 'info',
    muted: 'neutral',
};

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
        <Badge
            variant="status"
            tone={BADGE_TONE[tone]}
            dot
            className={className}
        >
            {children}
        </Badge>
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
