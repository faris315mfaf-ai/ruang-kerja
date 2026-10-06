import { Link } from '@inertiajs/react';
import { FileText, ListChecks, Sheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { hiringUrls, SOURCE_LABELS, STAGE_LABELS, STAGE_TONES } from './lib';
import { StageMenu } from './stage-control';
import type { CandidateCard as Card } from './types';

/** Checklist progress "3/5 wajib" (required items). */
export function ChecklistCount({
    done,
    total,
}: {
    done: number;
    total: number;
}) {
    if (total === 0) {
        return null;
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 tnum',
                done === total ? 'text-success' : 'text-text-muted',
            )}
            title="Butir checklist wajib yang sudah dicentang"
        >
            <ListChecks aria-hidden className="size-4" />
            {done}/{total}
            <span className="sr-only"> butir wajib selesai</span>
        </span>
    );
}

/**
 * Candidate card of the board (desktop) and list (phone): name, position,
 * when and how they applied, checklist progress, "menunggu keputusan Anda".
 * HR gets the "Pindahkan" menu next to it.
 */
export function CandidateCard({
    candidate,
    canManage,
    showPosition,
    showStage = false,
}: {
    candidate: Card;
    canManage: boolean;
    showPosition: boolean;
    showStage?: boolean;
}) {
    const SourceIcon = candidate.source === 'google_form' ? Sheet : FileText;

    return (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
            <Link
                href={hiringUrls.candidate(candidate.id)}
                className={cn(
                    'flex min-w-0 flex-col gap-1 rounded-sm',
                    focusRing,
                )}
            >
                <span className="line-clamp-2 text-[17px] leading-6 font-semibold text-text">
                    {candidate.full_name}
                </span>
                {showPosition && (
                    <span className="truncate text-meta text-text-muted">
                        {candidate.position.title}
                    </span>
                )}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
                {showStage && (
                    <Badge
                        variant="status"
                        tone={STAGE_TONES[candidate.stage]}
                        dot
                        className="h-7 text-[14px]"
                    >
                        {STAGE_LABELS[candidate.stage]}
                    </Badge>
                )}
                {candidate.awaiting_me && (
                    <Badge
                        variant="status"
                        tone="warning"
                        dot
                        className="h-7 text-[14px]"
                    >
                        Menunggu keputusan Anda
                    </Badge>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-meta text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                    <SourceIcon
                        aria-hidden
                        className="size-4 text-text-subtle"
                    />
                    <span className="sr-only">
                        {SOURCE_LABELS[candidate.source]} ·{' '}
                    </span>
                    {formatRelative(candidate.applied_at)}
                </span>
                <ChecklistCount {...candidate.checklist} />
            </div>
            {canManage && (
                <StageMenu
                    candidateId={candidate.id}
                    candidateName={candidate.full_name}
                    stage={candidate.stage}
                    className="w-full justify-center"
                />
            )}
        </article>
    );
}
