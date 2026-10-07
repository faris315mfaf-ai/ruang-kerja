import * as DialogPrimitive from '@radix-ui/react-dialog';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaskPresence } from '../realtime/presence';
import { usePublishTaskViewing } from '../realtime/workspace-presence';
import type { Task } from '../types';
import { TaskDetailBody } from './task-detail-body';
import type { DetailNavigation } from './task-detail-header';
import { TaskDetailHeader } from './task-detail-header';
import { useTaskDetail } from './use-task-detail';

type Props = {
    taskId: string | null;
    today: string;
    /** Visible task ids of the board/list (J/K and ↑/↓ in the header). */
    navigationIds?: string[];
    onNavigate: (taskId: string) => void;
    onClose: () => void;
    onTaskChange?: (task: Task) => void;
};

function typing(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
            target.closest('[role="menu"], [role="listbox"]') !== null)
    );
}

export function SheetSkeleton() {
    return (
        <div
            className="space-y-4 px-6 py-6"
            aria-busy
            aria-label="Memuat tugas"
        >
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
        </div>
    );
}

/**
 * Right panel 640px with the task detail (desktop board, list, calendar,
 * Tugas saya). The URL stays on the board; "Buka layar penuh" goes to
 * /w/{KEY}/tasks/{n}. J/K (or ↑/↓ in the header) walk the visible tasks.
 */
export function TaskSheet({
    taskId,
    today,
    navigationIds = [],
    onNavigate,
    onClose,
    onTaskChange,
}: Props) {
    const { auth } = usePage().props;
    const state = useTaskDetail(taskId, { onTaskChange, onDeleted: onClose });
    const viewers = useTaskPresence(taskId, auth.user?.id);
    // Board cards of the workspace show who has this task open.
    const loaded =
        state.detail && state.detail.task.id === taskId ? state.detail : null;
    usePublishTaskViewing(
        loaded?.workspace.id,
        taskId,
        auth.user?.id,
        loaded?.workspace.type !== 'personal',
    );
    const index = taskId ? navigationIds.indexOf(taskId) : -1;
    const navigation: DetailNavigation | null =
        index >= 0
            ? {
                  index,
                  total: navigationIds.length,
                  onPrevious:
                      index > 0
                          ? () => onNavigate(navigationIds[index - 1])
                          : null,
                  onNext:
                      index < navigationIds.length - 1
                          ? () => onNavigate(navigationIds[index + 1])
                          : null,
              }
            : null;

    useEffect(() => {
        if (!taskId || !navigation) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                typing(event.target)
            ) {
                return;
            }

            const key = event.key.toLowerCase();

            if (key === 'j' && navigation.onNext) {
                event.preventDefault();
                navigation.onNext();
            } else if (key === 'k' && navigation.onPrevious) {
                event.preventDefault();
                navigation.onPrevious();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [taskId, navigation]);

    const { detail } = state;

    return (
        <DialogPrimitive.Root
            open={taskId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    onEscapeKeyDown={(event) => {
                        // Esc inside an editor/input cancels that edit first.
                        if (
                            typing(event.target) ||
                            typing(document.activeElement)
                        ) {
                            event.preventDefault();
                            (
                                document.activeElement as HTMLElement | null
                            )?.blur();
                        }
                    }}
                    className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l border-border bg-background shadow-float data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
                >
                    <DialogPrimitive.Title className="sr-only">
                        {detail
                            ? `${detail.task.key} ${detail.task.title}`
                            : 'Detail tugas'}
                    </DialogPrimitive.Title>
                    {state.deleted ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                            <p className="font-medium text-text">
                                Tugas tidak tersedia
                            </p>
                            <p className="text-[15px] text-text-muted">
                                Tugas ini sudah dihapus atau Anda tidak lagi
                                punya akses.
                            </p>
                        </div>
                    ) : detail && detail.task.id === taskId ? (
                        <>
                            <div className="relative">
                                <TaskDetailHeader
                                    state={{ ...state, detail }}
                                    viewers={viewers}
                                    layout="sheet"
                                    navigation={navigation}
                                    onClose={onClose}
                                />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                <TaskDetailBody
                                    state={{ ...state, detail }}
                                    today={today}
                                    layout="sheet"
                                    onOpenTask={(task) => onNavigate(task.id)}
                                />
                            </div>
                        </>
                    ) : state.error ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                            <p className="text-[15px] text-danger">
                                {state.error}
                            </p>
                            <button
                                type="button"
                                onClick={() => void state.reload()}
                                className="h-10 rounded-control border border-border-strong bg-surface px-4 text-[15px] font-semibold text-text hover:bg-surface-2"
                            >
                                Coba lagi
                            </button>
                        </div>
                    ) : (
                        <SheetSkeleton />
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
