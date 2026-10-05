import { Head, Link } from '@inertiajs/react';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { describeActivity } from '@/features/workspaces/activity-text';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type {
    ActivityItem,
    WorkspacePageProps,
} from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { formatDateTime, formatRelative } from '@/lib/format';

type Props = WorkspacePageProps & {
    activities: {
        data: ActivityItem[];
        next_page_url: string | null;
        prev_page_url: string | null;
        current_page: number;
    };
};

/** Tab Aktivitas: append-only feed of the workspace (task.created, status, assign, due date…). */
export default function WorkspaceActivity(props: Props) {
    const { activities, members } = props;
    const names = Object.fromEntries(
        members.map((member) => [member.id, member.name]),
    );

    return (
        <>
            <Head title={`${props.workspace.name} · Aktivitas`} />
            <WorkspaceShell {...props} tab="activity">
                {activities.data.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title="Belum ada aktivitas"
                        description="Perubahan tugas dan anggota akan tercatat di sini."
                    />
                ) : (
                    <ol className="max-w-3xl divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                        {activities.data.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-start gap-3 px-4 py-3"
                            >
                                {item.causer ? (
                                    <UserAvatar
                                        name={item.causer.name}
                                        src={item.causer.avatar}
                                        className="size-7 text-[10px]"
                                    />
                                ) : (
                                    <span
                                        aria-hidden
                                        className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-text-muted"
                                    >
                                        <History className="size-3.5" />
                                    </span>
                                )}
                                <p className="min-w-0 flex-1 text-[14px] leading-6 text-text">
                                    <span className="font-medium">
                                        {item.causer?.name ?? 'Sistem'}
                                    </span>{' '}
                                    {describeActivity(item, names)}
                                </p>
                                <time
                                    dateTime={item.created_at}
                                    title={formatDateTime(item.created_at)}
                                    className="shrink-0 text-[12px] text-text-muted"
                                >
                                    {formatRelative(item.created_at)}
                                </time>
                            </li>
                        ))}
                    </ol>
                )}
                {(activities.prev_page_url || activities.next_page_url) && (
                    <div className="flex max-w-3xl justify-between">
                        {activities.prev_page_url ? (
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={activities.prev_page_url}
                                    preserveScroll
                                >
                                    Lebih baru
                                </Link>
                            </Button>
                        ) : (
                            <span />
                        )}
                        {activities.next_page_url && (
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={activities.next_page_url}
                                    preserveScroll
                                >
                                    Lebih lama
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </WorkspaceShell>
        </>
    );
}

WorkspaceActivity.layout = (props: Props) =>
    workspaceLayout(props, 'Aktivitas');
