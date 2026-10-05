import { router } from '@inertiajs/react';
import {
    Check,
    Flag,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import {
    daysBetween,
    dueLabel,
    MILESTONE_LABELS,
    shortDay,
    weekdayDay,
} from '@/features/portfolio/lib';
import type {
    MilestoneDetail,
    MilestoneStatus,
    ProjectSummaryProps,
} from '@/features/portfolio/types';
import { cn } from '@/lib/utils';
import {
    complete,
    destroy as destroyMilestone,
} from '@/routes/projects/milestones';

const STATUS_TONES: Record<MilestoneStatus, BadgeTone> = {
    completed: 'success',
    completed_late: 'warning',
    missed: 'danger',
    in_progress: 'info',
    not_started: 'neutral',
};

const isDone = (milestone: MilestoneDetail) =>
    milestone.status === 'completed' || milestone.status === 'completed_late';

/** Share of the milestone's linked tasks that are done (0–100), null without tasks. */
export function milestoneTaskPercent(
    milestone: MilestoneDetail,
): number | null {
    if (milestone.tasks.length === 0) {
        return null;
    }

    const done = milestone.tasks.filter(
        (task) => task.status_category === 'done',
    ).length;

    return Math.round((done / milestone.tasks.length) * 100);
}

/** "Target Jum, 18 Sep · selesai Kam, 17 Sep" · "Target Rab, 14 Okt · 9 hari lagi". */
function milestoneMeta(milestone: MilestoneDetail, today: string): string {
    const target = `Target ${weekdayDay(milestone.target_date)}`;

    if (isDone(milestone)) {
        const doneDay = milestone.completed_at?.slice(0, 10) ?? null;
        const late = doneDay ? daysBetween(milestone.target_date, doneDay) : 0;

        return `${target} · selesai ${weekdayDay(doneDay)}${late > 0 ? ` (terlambat ${late} hari)` : ''}`;
    }

    if (milestone.status === 'missed') {
        return `${target} · lewat ${Math.abs(daysBetween(today, milestone.target_date))} hari`;
    }

    const remaining = daysBetween(today, milestone.target_date);

    return remaining >= 0 ? `${target} · ${dueLabel(remaining)}` : target;
}

/** 32px timeline dot: done ✓ · missed ! · running gradient · todo ring. */
function Dot({ status }: { status: MilestoneStatus }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold text-on-brand',
                (status === 'completed' || status === 'completed_late') &&
                    'bg-success',
                status === 'missed' && 'bg-fill-danger',
                status === 'in_progress' && 'bg-primary bg-grad-aksi',
                status === 'not_started' &&
                    'border-[3px] border-border-strong bg-surface',
            )}
        >
            {(status === 'completed' || status === 'completed_late') && (
                <Check className="size-4" strokeWidth={3} />
            )}
            {status === 'missed' && '!'}
        </span>
    );
}

function MilestoneMenu({
    milestone,
    onEdit,
    onComplete,
    onRemove,
}: {
    milestone: MilestoneDetail;
    onEdit: () => void;
    onComplete: (completed: boolean) => void;
    onRemove: () => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="-my-1.5 shrink-0"
                    aria-label={`Aksi milestone ${milestone.name}`}
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {isDone(milestone) ? (
                    <DropdownMenuItem onSelect={() => onComplete(false)}>
                        <RotateCcw /> Buka kembali
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem onSelect={() => onComplete(true)}>
                        <Check /> Tandai selesai
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={onEdit}>
                    <Pencil /> Ubah
                </DropdownMenuItem>
                <DropdownMenuItem className="text-danger" onSelect={onRemove}>
                    <Trash2 /> Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Milestone timeline (DProyek / MgPMilestone). */
export function MilestonesPanel({
    props,
    onEdit,
    onCreate,
    compact = false,
}: {
    props: ProjectSummaryProps;
    onEdit: (milestone: MilestoneDetail) => void;
    onCreate: () => void;
    compact?: boolean;
}) {
    const { milestones, project, today, project_can: can } = props;
    const done = milestones.filter(isDone).length;
    const missed = milestones.filter(
        (milestone) => milestone.status === 'missed',
    ).length;

    const setCompleted = (milestone: MilestoneDetail, completed: boolean) =>
        router.patch(
            complete({ workspace: project.key, milestone: milestone.id }).url,
            { completed },
            { preserveScroll: true },
        );

    const remove = (milestone: MilestoneDetail) => {
        if (window.confirm(`Hapus milestone "${milestone.name}"?`)) {
            router.delete(
                destroyMilestone({
                    workspace: project.key,
                    milestone: milestone.id,
                }).url,
                { preserveScroll: true },
            );
        }
    };

    return (
        <Panel
            title="Milestone"
            action={
                <span className="flex items-center gap-3">
                    <span className="text-label font-normal text-text-muted">
                        {done} dari {milestones.length} selesai
                        {missed > 0 && (
                            <span className="font-semibold text-danger">
                                {' '}
                                · {missed} terlewat
                            </span>
                        )}
                    </span>
                    {can.manage && (
                        <Button variant="tonal" size="sm" onClick={onCreate}>
                            <Plus aria-hidden /> Milestone
                        </Button>
                    )}
                </span>
            }
        >
            {milestones.length === 0 ? (
                <EmptyState size="sm" icon={Flag} title="Belum ada milestone">
                    {can.manage
                        ? 'Tambahkan target antara agar Direksi bisa memantau jadwal.'
                        : 'PIC belum menetapkan milestone.'}
                </EmptyState>
            ) : (
                <ol className="flex flex-col pt-2">
                    {milestones.map((milestone, index) => {
                        const last = index === milestones.length - 1;
                        const pct =
                            milestone.status === 'in_progress'
                                ? milestoneTaskPercent(milestone)
                                : null;

                        return (
                            <li key={milestone.id} className="flex gap-4">
                                <span className="flex w-8 shrink-0 flex-col items-center">
                                    <Dot status={milestone.status} />
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'min-h-[22px] w-0.5 flex-1',
                                            !last && 'bg-border',
                                        )}
                                    />
                                </span>
                                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 pb-[18px]">
                                    <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
                                        <span
                                            className={cn(
                                                'text-[17px] leading-6 font-bold',
                                                milestone.status === 'missed' &&
                                                    'text-danger',
                                            )}
                                        >
                                            {milestone.name}
                                            {milestone.target_date ===
                                                project.target_date &&
                                                last && (
                                                    <span className="font-normal text-text-muted">
                                                        {' '}
                                                        · target proyek
                                                    </span>
                                                )}
                                        </span>
                                        <span className="text-label font-normal text-text-muted">
                                            {compact
                                                ? `${shortDay(milestone.target_date)} · ${MILESTONE_LABELS[milestone.status]}`
                                                : milestoneMeta(
                                                      milestone,
                                                      today,
                                                  )}
                                        </span>
                                        {milestone.description && !compact && (
                                            <span className="text-label font-normal text-text-muted">
                                                {milestone.description}
                                            </span>
                                        )}
                                        {pct !== null && (
                                            <span className="flex items-center gap-2.5 text-meta text-text-muted">
                                                <Progress
                                                    value={pct}
                                                    size="sm"
                                                    label={`Tugas milestone ${milestone.name} selesai`}
                                                    className="w-[180px] max-w-full"
                                                />
                                                {pct}% tugas
                                            </span>
                                        )}
                                        {milestone.tasks.length > 0 && (
                                            <span className="flex flex-wrap gap-1.5 pt-1">
                                                {milestone.tasks.map((task) => (
                                                    <Badge
                                                        key={task.id}
                                                        variant="label"
                                                        title={task.title}
                                                        className={cn(
                                                            'h-7 px-2 font-mono text-[13px]',
                                                            task.status_category ===
                                                                'done' &&
                                                                'text-text-muted',
                                                        )}
                                                    >
                                                        {task.code}
                                                    </Badge>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                    <span className="flex shrink-0 items-center gap-1">
                                        <Badge
                                            variant="status"
                                            tone={
                                                STATUS_TONES[milestone.status]
                                            }
                                            className="h-[30px] text-[14px]"
                                        >
                                            {MILESTONE_LABELS[milestone.status]}
                                        </Badge>
                                        {can.manage && (
                                            <MilestoneMenu
                                                milestone={milestone}
                                                onEdit={() => onEdit(milestone)}
                                                onComplete={(completed) =>
                                                    setCompleted(
                                                        milestone,
                                                        completed,
                                                    )
                                                }
                                                onRemove={() =>
                                                    remove(milestone)
                                                }
                                            />
                                        )}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Panel>
    );
}
