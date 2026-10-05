import { Head, router } from '@inertiajs/react';
import { MobileTaskAppBarActions } from '@/features/tasks/detail/mobile-app-bar-actions';
import { TaskDetailBody } from '@/features/tasks/detail/task-detail-body';
import { TaskDetailHeader } from '@/features/tasks/detail/task-detail-header';
import { TaskDetailMobile } from '@/features/tasks/detail/task-detail.mobile';
import { SheetSkeleton } from '@/features/tasks/detail/task-sheet';
import type { TaskDetail } from '@/features/tasks/detail/types';
import { useTaskDetail } from '@/features/tasks/detail/use-task-detail';
import { useTaskPresence } from '@/features/tasks/realtime/presence';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { EmptyState } from '@/components/empty-state';
import { FileX } from 'lucide-react';

type Props = {
    detail: TaskDetail;
    today: string;
};

/**
 * Full-screen task detail /w/{KEY}/tasks/{n} (mockups TaskDetail and
 * MTaskDetail). Target of search results, notifications and shared links.
 */
export default function TaskShow({ detail: initial, today }: Props) {
    const breakpoint = useBreakpoint();
    const state = useTaskDetail(initial.task.id, {
        initial,
        onDeleted: () => router.visit(`/w/${initial.workspace.key}`),
    });
    const viewers = useTaskPresence(initial.task.id, state.viewer?.id);
    const detail = state.detail;

    if (state.deleted) {
        return (
            <EmptyState
                icon={FileX}
                title="Tugas tidak tersedia"
                description="Tugas ini sudah dihapus atau Anda tidak lagi punya akses."
            />
        );
    }

    return (
        <>
            <Head
                title={`${initial.task.key} ${detail?.task.title ?? initial.task.title}`}
            />
            {!detail ? (
                <SheetSkeleton />
            ) : breakpoint === 'mobile' ? (
                <TaskDetailMobile state={{ ...state, detail }} today={today} />
            ) : (
                <div className="-m-4 flex min-h-[calc(100svh-56px)] flex-col lg:-m-6">
                    <div className="relative">
                        <TaskDetailHeader
                            state={{ ...state, detail }}
                            viewers={viewers}
                            layout="page"
                        />
                    </div>
                    <TaskDetailBody
                        state={{ ...state, detail }}
                        today={today}
                        layout="page"
                    />
                </div>
            )}
        </>
    );
}

TaskShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Workspace', href: '/workspace' },
        {
            title:
                props.detail.workspace.type === 'personal'
                    ? 'Pribadi'
                    : props.detail.workspace.name,
            href: `/w/${props.detail.workspace.key}`,
        },
        { title: props.detail.task.key, href: props.detail.url },
    ],
    title: props.detail.task.key,
    back: `/w/${props.detail.workspace.key}`,
    appBarActions: (
        <MobileTaskAppBarActions
            taskId={props.detail.task.id}
            url={props.detail.url}
            title={props.detail.task.title}
        />
    ),
});
