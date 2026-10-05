import { Check, CornerUpLeft, Minus, X } from 'lucide-react';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RequestDetail, TimelineStep } from '@/types/requests';

/** " sejak 2 hari" (empty for just now). */
function since(value: string | null): string {
    const relative = value ? formatRelative(value) : 'baru saja';

    return relative === 'baru saja'
        ? ''
        : ` sejak ${relative.replace(/ lalu$/, '')}`;
}

function StepIcon({ step }: { step: TimelineStep }) {
    const base =
        'relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full';

    switch (step.status) {
        case 'approved':
            return (
                <span className={cn(base, 'bg-success text-on-brand')}>
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                </span>
            );
        case 'rejected':
            return (
                <span className={cn(base, 'bg-danger text-on-danger')}>
                    <X className="size-4" strokeWidth={3} aria-hidden />
                </span>
            );
        case 'revision_requested':
            return (
                <span className={cn(base, 'bg-info text-on-brand')}>
                    <CornerUpLeft
                        className="size-4"
                        strokeWidth={3}
                        aria-hidden
                    />
                </span>
            );
        case 'waiting':
            return (
                <span
                    className={cn(
                        base,
                        'border-[3px] border-fill-warning bg-surface',
                    )}
                ></span>
            );
        case 'skipped':
            return (
                <span
                    className={cn(
                        base,
                        'border-2 border-dashed border-border-strong bg-surface text-text-subtle',
                    )}
                >
                    <Minus className="size-4" aria-hidden />
                </span>
            );
        default:
            return (
                <span
                    className={cn(
                        base,
                        'border-[3px] border-border-strong bg-surface text-[13px] font-bold text-text-muted',
                    )}
                >
                    {step.step_order}
                </span>
            );
    }
}

function stepDetail(
    step: TimelineStep,
    viewerId: string | undefined,
    previous: TimelineStep | undefined,
): React.ReactNode {
    const who = step.approver
        ? `${step.approver.name}${step.approver.id === viewerId ? ' (Anda)' : ''}`
        : null;
    const delegated = step.delegated_from
        ? ` · menggantikan ${step.delegated_from.name}`
        : '';

    switch (step.status) {
        case 'waiting':
            return (
                <span className="text-warning">
                    {who ?? `Pemegang peran ${step.label}`}
                    {delegated} · menunggu{since(step.activated_at)}
                </span>
            );
        case 'approved':
            return `${who ?? step.label}${delegated} · disetujui ${formatDateTime(step.decided_at)}`;
        case 'rejected':
            return `${who ?? step.label} · ditolak ${formatDateTime(step.decided_at)}`;
        case 'revision_requested':
            return `${who ?? step.label} · minta revisi ${formatDateTime(step.decided_at)}`;
        case 'skipped':
            return step.note ?? 'Dilewati';
        default:
            return previous
                ? `Setelah langkah ${previous.step_order} disetujui`
                : 'Menunggu giliran';
    }
}

/**
 * Vertical approval timeline: submitted → steps of the current round (earlier
 * rounds' decisions shown first as history).
 */
export function ApprovalTimeline({
    request,
    viewerId,
}: {
    request: RequestDetail;
    viewerId?: string;
}) {
    const history = request.timeline.filter((step) => !step.current_round);
    const current = request.timeline.filter((step) => step.current_round);
    const isSelf = request.user.id === viewerId;

    const rows: {
        key: string;
        icon: React.ReactNode;
        title: React.ReactNode;
        detail: React.ReactNode;
        note?: string | null;
    }[] = [];

    for (const step of history) {
        rows.push({
            key: step.id,
            icon: <StepIcon step={step} />,
            title: `Putaran ${step.round} · Langkah ${step.step_order} · ${step.label}`,
            detail: stepDetail(step, viewerId, undefined),
            note: step.note,
        });
    }

    rows.push({
        key: 'submitted',
        icon: (
            <span className="relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full bg-success text-on-brand">
                <Check className="size-4" strokeWidth={3} aria-hidden />
            </span>
        ),
        title: isSelf
            ? request.round > 1
                ? 'Diajukan ulang'
                : 'Diajukan'
            : `Diajukan oleh ${request.user.name}`,
        detail: request.submitted_at
            ? formatDateTime(request.submitted_at)
            : 'Belum dikirim (draf)',
    });

    current.forEach((step, index) => {
        rows.push({
            key: step.id,
            icon: <StepIcon step={step} />,
            title: (
                <span
                    className={cn(
                        step.status === 'skipped' &&
                            'text-text-muted line-through decoration-text-subtle',
                    )}
                >
                    Langkah {step.step_order} · {step.label}
                </span>
            ),
            detail: stepDetail(step, viewerId, current[index - 1]),
            note: step.status === 'skipped' ? null : step.note,
        });
    });

    return (
        <ol className="relative" aria-label="Alur persetujuan">
            {rows.map((row, index) => (
                <li
                    key={row.key}
                    className="relative flex gap-3.5 pb-4 last:pb-0"
                >
                    {index < rows.length - 1 && (
                        <span
                            aria-hidden
                            className="absolute top-[30px] bottom-0 left-[14px] w-0.5 bg-border"
                        />
                    )}
                    {row.icon}
                    <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                        <p className="text-[16px] leading-6 font-bold text-text md:text-[17px]">
                            {row.title}
                        </p>
                        <p className="text-[15px] leading-[22px] text-text-muted">
                            {row.detail}
                        </p>
                        {row.note && (
                            <p className="mt-1.5 rounded-control bg-surface-2 px-3 py-2 text-[15px] leading-[22px] text-text">
                                “{row.note}”
                            </p>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}
