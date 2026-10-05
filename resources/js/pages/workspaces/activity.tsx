import { Head, Link } from '@inertiajs/react';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
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
                    <Panel
                        flush
                        title="Aktivitas"
                        action={
                            <span className="text-label font-normal text-text-muted">
                                terbaru di atas
                            </span>
                        }
                        className="max-w-4xl pb-2"
                    >
                        <ol className="flex flex-col border-t border-divider">
                            {activities.data.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex min-h-[68px] items-start gap-3.5 border-b border-divider px-5 py-3.5 last:border-b-0 md:px-7"
                                >
                                    {item.causer ? (
                                        <UserAvatar
                                            name={item.causer.name}
                                            src={item.causer.avatar}
                                            className="size-10 text-[14px]"
                                        />
                                    ) : (
                                        <span
                                            aria-hidden
                                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted"
                                        >
                                            <History className="size-5" />
                                        </span>
                                    )}
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <p className="text-body">
                                            <span className="font-bold">
                                                {item.causer?.name ?? 'Sistem'}
                                            </span>{' '}
                                            {describeActivity(item, names)}
                                        </p>
                                        <time
                                            dateTime={item.created_at}
                                            title={formatDateTime(
                                                item.created_at,
                                            )}
                                            className="text-meta text-text-muted"
                                        >
                                            {formatRelative(item.created_at)}
                                        </time>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </Panel>
                )}
                {(activities.prev_page_url || activities.next_page_url) && (
                    <div className="flex max-w-4xl justify-between">
                        {activities.prev_page_url ? (
                            <Button asChild variant="outline">
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
                            <Button asChild variant="outline">
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
