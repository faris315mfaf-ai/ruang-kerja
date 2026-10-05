import { CircleCheck, MessageSquareText, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import {
    HEALTH_LABELS,
    HEALTH_TONES,
    weekdayDay,
} from '@/features/portfolio/lib';
import type {
    Direction,
    ProjectSummaryProps,
    ProjectUpdateItem,
} from '@/features/portfolio/types';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-overline text-text-muted">{label}</span>
            <p className="text-body whitespace-pre-line">{children}</p>
        </div>
    );
}

/** Directions of Direksi under an update or the project. */
export function DirectionList({ directions }: { directions: Direction[] }) {
    if (directions.length === 0) {
        return null;
    }

    return (
        <ul className="flex flex-col gap-2">
            {directions.map((direction) => (
                <li
                    key={direction.id}
                    className="flex gap-3 rounded-lg bg-surface-2 px-4 py-3"
                >
                    <UserAvatar
                        name={direction.author?.name ?? 'Direksi'}
                        src={direction.author?.avatar}
                        className="size-8 text-[12px]"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-meta text-text-muted">
                            <span className="font-bold text-text">
                                {direction.author?.name ?? 'Direksi'}
                            </span>{' '}
                            · {formatRelative(direction.created_at)}
                        </p>
                        <p className="text-label font-normal whitespace-pre-line">
                            {direction.body}
                        </p>
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** "Keputusan dibutuhkan" on the warm gradient (one per screen). */
function DecisionBox({
    update,
    canSteer,
    resolving,
    onResolve,
    onDiscuss,
}: {
    update: ProjectUpdateItem;
    canSteer: boolean;
    resolving: boolean;
    onResolve: () => void;
    onDiscuss: () => void;
}) {
    if (update.decision_resolved_at) {
        return (
            <div className="flex flex-col gap-1.5 rounded-lg bg-success-soft px-4 py-3.5 text-success">
                <span className="text-overline">Keputusan</span>
                <p className="text-body font-semibold text-text">
                    {update.decision_needed}
                </p>
                <p className="flex items-center gap-1.5 text-label">
                    <CircleCheck className="size-4" aria-hidden />
                    Ditandai selesai oleh{' '}
                    {update.decision_resolved_by ?? 'Direksi'} ·{' '}
                    {formatRelative(update.decision_resolved_at)}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5 rounded-lg bg-danger bg-grad-hangat px-4 py-3.5 text-on-brand shadow-warm">
            <span className="text-overline">Keputusan dibutuhkan</span>
            <p className="text-body font-semibold">{update.decision_needed}</p>
            {canSteer && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-0"
                        disabled={resolving}
                        onClick={onResolve}
                    >
                        Setujui
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-on-brand hover:bg-on-brand/18"
                        onClick={onDiscuss}
                    >
                        Diskusikan
                    </Button>
                </div>
            )}
        </div>
    );
}

/** "Update PIC" (DProyek / MProyek): latest weekly update + history. */
export function LatestUpdatePanel({
    props,
    onWrite,
    onDiscuss,
    onResolve,
    resolving,
}: {
    props: ProjectSummaryProps;
    onWrite: () => void;
    onDiscuss: (update: ProjectUpdateItem) => void;
    onResolve: (update: ProjectUpdateItem) => void;
    resolving: string | null;
}) {
    const [latest, ...history] = props.updates;
    const can = props.project_can;

    return (
        <Panel
            title="Update PIC"
            action={
                can.manage ? (
                    <Button size="sm" variant="tonal" onClick={onWrite}>
                        <Pencil aria-hidden /> Tulis update
                    </Button>
                ) : latest ? (
                    <span className="text-label font-normal text-text-muted">
                        {weekdayDay(latest.created_at.slice(0, 10))}
                    </span>
                ) : null
            }
            bodyClassName="gap-3.5"
        >
            {!latest ? (
                <EmptyState
                    size="sm"
                    icon={MessageSquareText}
                    title="Belum ada update"
                >
                    {can.manage
                        ? 'Tulis update pertama untuk Direksi.'
                        : 'PIC belum menulis update.'}
                </EmptyState>
            ) : (
                <>
                    <div className="flex items-center gap-3">
                        <UserAvatar
                            name={latest.author?.name ?? 'PIC'}
                            src={latest.author?.avatar}
                            className="size-11 text-[16px]"
                        />
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[17px] font-bold">
                                {latest.author?.name ?? '–'}
                            </span>
                            <span className="text-label">
                                <b className={HEALTH_TONES[latest.health].text}>
                                    {HEALTH_LABELS[latest.health]}
                                </b>
                                <span className="font-normal text-text-muted">
                                    {' '}
                                    · {formatRelative(latest.created_at)}
                                </span>
                            </span>
                        </span>
                    </div>
                    <Field label="Ringkasan">{latest.summary}</Field>
                    {latest.blockers && (
                        <Field label="Hambatan">{latest.blockers}</Field>
                    )}
                    {latest.decision_needed && (
                        <DecisionBox
                            update={latest}
                            canSteer={can.steer}
                            resolving={resolving === latest.id}
                            onResolve={() => onResolve(latest)}
                            onDiscuss={() => onDiscuss(latest)}
                        />
                    )}
                    <DirectionList directions={latest.directions} />
                </>
            )}
            {history.length > 0 && (
                <details className="group">
                    <summary className="-mx-1 inline-flex min-h-11 cursor-pointer items-center rounded-control px-1 text-[16px] font-semibold text-link marker:content-none">
                        Riwayat update ({props.updates.length})
                    </summary>
                    <ul className="flex flex-col">
                        {history.map((update) => (
                            <li
                                key={update.id}
                                className="flex flex-col gap-1 border-t border-divider py-2.5"
                            >
                                <span className="flex justify-between gap-3 text-label">
                                    <b>
                                        {weekdayDay(
                                            update.created_at.slice(0, 10),
                                        )}
                                    </b>
                                    <b
                                        className={cn(
                                            HEALTH_TONES[update.health].text,
                                        )}
                                    >
                                        {HEALTH_LABELS[update.health]}
                                    </b>
                                </span>
                                <span className="text-body">
                                    {update.summary}
                                </span>
                                {update.decision_needed &&
                                    !update.decision_resolved_at && (
                                        <span className="text-meta font-semibold text-danger">
                                            Keputusan tertunda
                                        </span>
                                    )}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </Panel>
    );
}
