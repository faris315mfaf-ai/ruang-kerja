import type { FormEvent, ReactNode } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import type { BadgeTone } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { OkrStatus } from './types';

export const STATUS_META: Record<
    OkrStatus,
    {
        label: string;
        tone: BadgeTone;
        stroke: string;
        progress: 'brand' | 'warning' | 'danger';
    }
> = {
    on_track: {
        label: 'Sesuai jalur',
        tone: 'success',
        stroke: 'stroke-fill-teal',
        progress: 'brand',
    },
    at_risk: {
        label: 'Berisiko',
        tone: 'warning',
        stroke: 'stroke-fill-warning',
        progress: 'warning',
    },
    behind: {
        label: 'Tertinggal',
        tone: 'danger',
        stroke: 'stroke-fill-danger',
        progress: 'danger',
    },
};

export function StatusBadge({
    status,
    className,
}: {
    status: OkrStatus;
    className?: string;
}) {
    const meta = STATUS_META[status];

    return (
        <Badge variant="status" tone={meta.tone} dot className={className}>
            {meta.label}
        </Badge>
    );
}

/** Progress ring (PDirutPortofolio card): track + coloured arc + % in the middle. */
export function ProgressRing({
    value,
    status,
    size = 56,
    stroke = 6,
    label,
    className,
    children,
}: {
    /** 0–1. */
    value: number;
    status: OkrStatus;
    size?: number;
    stroke?: number;
    label: string;
    className?: string;
    children?: ReactNode;
}) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

    return (
        <span
            role="img"
            aria-label={`${label}: ${pct}%`}
            className={cn('relative inline-flex shrink-0', className)}
            style={{ width: size, height: size }}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="-rotate-90"
                aria-hidden
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    className="stroke-surface-2"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - pct / 100)}
                    className={cn(
                        STATUS_META[status].stroke,
                        'transition-[stroke-dashoffset] duration-180 ease-brand motion-reduce:transition-none',
                    )}
                />
            </svg>
            <span
                aria-hidden
                className="absolute inset-0 flex flex-col items-center justify-center"
            >
                {children ?? (
                    <span
                        className={cn(
                            'font-extrabold tnum',
                            size >= 96 ? 'text-[26px]' : 'text-[14px]',
                        )}
                    >
                        {pct}%
                    </span>
                )}
            </span>
        </span>
    );
}

/**
 * Form dialog that is a centred glass dialog on desktop/tablet and a bottom
 * sheet with a sticky action bar on phones.
 */
export function ResponsiveFormDialog({
    open,
    onOpenChange,
    mobile,
    title,
    description,
    actions,
    onSubmit,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile: boolean;
    title: string;
    description?: string;
    actions: ReactNode;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    children: ReactNode;
}) {
    const formId = `form-${title.replace(/\W+/g, '-').toLowerCase()}`;

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                description={description}
                footer={
                    <div className="flex gap-2 [&>*]:flex-1">{actions}</div>
                }
            >
                <form
                    id={formId}
                    onSubmit={onSubmit}
                    noValidate
                    className="flex flex-col gap-4 pt-1"
                >
                    {children}
                </form>
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription
                        className={description ? undefined : 'sr-only'}
                    >
                        {description ?? title}
                    </DialogDescription>
                </DialogHeader>
                <form
                    id={formId}
                    onSubmit={onSubmit}
                    noValidate
                    className="flex flex-col gap-4"
                >
                    {children}
                </form>
                <DialogFooter>{actions}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** `form` attribute value for submit buttons rendered outside the form. */
export function formIdFor(title: string): string {
    return `form-${title.replace(/\W+/g, '-').toLowerCase()}`;
}

/** Field wrapper: label, control, hint/error (ids wired for aria). */
export function Field({
    id,
    label,
    error,
    hint,
    children,
    className,
}: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <label htmlFor={id} className="text-label text-text">
                {label}
            </label>
            {children}
            {(error || hint) && (
                <p
                    id={`${id}-hint`}
                    className={cn(
                        'text-[14px] leading-5',
                        error ? 'text-danger' : 'text-text-muted',
                    )}
                >
                    {error ?? hint}
                </p>
            )}
        </div>
    );
}
