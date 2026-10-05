import { CircleCheck, Users } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { Panel, PanelLink } from '@/components/ui/panel';
import { daysBetween } from '@/features/portfolio/lib';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import { show as taskShow } from '@/routes/tasks';
import { show as workspaceTasks } from '@/routes/workspaces';

/** "Tugas terlambat" (DProyek): mono code chip, title, assignee, red "N hari". */
export function OverduePanel({
    props,
    compact = false,
}: {
    props: ProjectSummaryProps;
    compact?: boolean;
}) {
    const tasks = props.overdue_tasks;
    const href = `${workspaceTasks.url(props.project.key)}?view=list`;

    return (
        <Panel
            flush
            title={
                <>
                    Tugas terlambat
                    <Badge
                        variant="status"
                        tone={tasks.length > 0 ? 'danger' : 'neutral'}
                        className="h-7 px-2.5"
                    >
                        {tasks.length}
                    </Badge>
                </>
            }
            action={
                <PanelLink href={href}>
                    {compact
                        ? 'Semua tugas'
                        : `Semua tugas (${props.project.metrics.scope})`}
                </PanelLink>
            }
            className="pb-2"
        >
            {tasks.length === 0 ? (
                <div className="px-5 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={CircleCheck}
                        title="Tidak ada tugas terlambat"
                    />
                </div>
            ) : (
                <ul className="flex flex-col border-t border-divider">
                    {tasks.map((task) => {
                        const late = Math.abs(
                            daysBetween(
                                props.today,
                                task.due_date ?? props.today,
                            ),
                        );

                        return (
                            <li
                                key={task.id}
                                className="border-b border-divider last:border-b-0"
                            >
                                <ListRow
                                    href={taskShow.url(task.id)}
                                    className="min-h-[66px] gap-4"
                                    leading={
                                        <span className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-[14px] font-semibold">
                                            {task.code}
                                        </span>
                                    }
                                    title={task.title}
                                    meta={
                                        task.assignee?.name ??
                                        'Belum ditugaskan'
                                    }
                                    trailing={
                                        <Badge
                                            variant="status"
                                            tone="danger"
                                            className="h-[30px]"
                                        >
                                            {late} hari
                                        </Badge>
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/** "Tim & beban" (DProyek): avatar, name, open-task bar, count. */
export function TeamLoadPanel({ props }: { props: ProjectSummaryProps }) {
    const { members, idle, open_total: openTotal } = props.team_load;
    const max = Math.max(5, ...members.map((member) => member.open));

    return (
        <Panel
            title="Tim & beban"
            action={
                <span className="text-label font-normal text-text-muted">
                    tugas terbuka
                </span>
            }
            bodyClassName="gap-3.5"
        >
            {members.length === 0 ? (
                <EmptyState size="sm" icon={Users} title="Belum ada beban">
                    Belum ada tugas terbuka yang ditugaskan.
                </EmptyState>
            ) : (
                <ul className="flex flex-col gap-3.5">
                    {members.map((member) => (
                        <li
                            key={member.person?.id ?? 'none'}
                            className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3"
                        >
                            <UserAvatar
                                name={member.person?.name ?? '?'}
                                src={member.person?.avatar}
                                className="size-10 text-[14px]"
                            />
                            <span className="flex min-w-0 flex-col gap-1.5">
                                <span className="truncate text-label">
                                    {member.person?.name ?? '–'}
                                </span>
                                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                                    <span
                                        className="block h-full rounded-full bg-grad-merek-x"
                                        style={{
                                            width: `${(member.open / max) * 100}%`,
                                        }}
                                    />
                                </span>
                            </span>
                            <span className="text-right text-[16px] font-bold tnum">
                                {member.open}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-meta text-text-muted">
                {openTotal} tugas terbuka
                {idle > 0 && ` · ${idle} anggota lain tanpa tugas terbuka`}.
                Skala batang 0–{max}.
            </p>
        </Panel>
    );
}
