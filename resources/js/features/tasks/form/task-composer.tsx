import { router, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { TaskSheet } from '../detail/task-sheet';
import type { Task, WorkspaceTaskOptions } from '../types';
import type { TaskFormDefaults } from './task-form';
import { TaskForm } from './task-form';
import { useFormOptions } from './use-form-options';

type ComposerState = {
    mode: 'create';
    defaults?: TaskFormDefaults;
    workspaceKey?: string;
};

type ComposerApi = {
    openCreate: (defaults?: TaskFormDefaults) => void;
    /**
     * Opens the task detail: the TaskSheet on desktop/tablet, the
     * full-screen page /w/{KEY}/tasks/{n} on mobile (Sprint 6).
     */
    openEdit: (task: Task, workspaceKey?: string) => void;
    /** Id of the task open in the sheet (board highlight / shortcuts). */
    openTaskId: string | null;
    /**
     * The page's visible tasks in display order and a callback for changes
     * made in the sheet (board/list keep in sync without a reload).
     */
    registerList: (list: TaskListContext) => void;
    /** False when the user cannot create tasks here (viewer, archived). */
    canCreate: boolean;
};

export type TaskListContext = {
    ids: string[];
    onTaskChange?: (task: Task) => void;
};

/** "PLQ-21" → "PLQ" (the key is `${workspace.key}-${number}`). */
export function workspaceKeyOf(task: Pick<Task, 'key' | 'number'>): string {
    return task.key.slice(0, task.key.length - String(task.number).length - 1);
}

const ComposerContext = createContext<ComposerApi | null>(null);

export function useTaskComposer(): ComposerApi {
    const api = useContext(ComposerContext);

    if (!api) {
        throw new Error(
            'useTaskComposer must be used inside TaskComposerProvider.',
        );
    }

    return api;
}

/** Ignore single-key shortcuts while typing or inside dialogs/menus. */
export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !==
            null
    );
}

type Props = {
    children: ReactNode;
    /** The workspace of the current page (board/list/calendar). */
    workspace?: WorkspaceTaskOptions;
    today: string;
    canCreate: boolean;
    /** Visible task ids in display order (sheet J/K and "6 dari 18"). */
    navigationIds?: string[];
    /** Keep the page's task list in sync with changes made in the sheet. */
    onTaskChange?: (task: Task) => void;
};

/**
 * Quick create & edit for tasks: a dialog on desktop, a bottom sheet on
 * mobile (mockup MTugasBaru). Shortcut `C` opens "Tugas baru" anywhere the
 * provider is mounted. Outside a workspace (Tugas saya) the workspaces are
 * loaded from GET /tugas/opsi-form.
 */
export function TaskComposerProvider({
    children,
    workspace,
    today,
    canCreate,
    navigationIds,
    onTaskChange,
}: Props) {
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const [state, setState] = useState<ComposerState | null>(null);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const [listContext, setListContext] = useState<TaskListContext | null>(
        null,
    );
    const needsList = state !== null;
    const { options: list, error } = useFormOptions(needsList);

    useEffect(() => {
        if (!canCreate) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key.toLowerCase() !== 'c' ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                event.repeat ||
                isTypingTarget(event.target)
            ) {
                return;
            }

            event.preventDefault();
            setState({ mode: 'create' });
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [canCreate]);

    const api: ComposerApi = {
        canCreate,
        openTaskId,
        registerList: setListContext,
        openCreate: (defaults) => setState({ mode: 'create', defaults }),
        openEdit: (task, workspaceKey) => {
            if (breakpoint === 'mobile') {
                router.visit(
                    `/w/${workspaceKey ?? workspaceKeyOf(task)}/tasks/${task.number}`,
                );

                return;
            }

            setOpenTaskId(task.id);
        },
    };

    const key = state?.workspaceKey ?? workspace?.key ?? list?.[0]?.key;
    const options: WorkspaceTaskOptions | undefined =
        workspace && workspace.key === key
            ? workspace
            : list?.find((item) => item.key === key);
    const close = () => setState(null);
    const title = 'Tugas baru';

    const body =
        state === null ? null : options ? (
            <TaskForm
                key="create"
                variant={breakpoint === 'mobile' ? 'sheet' : 'dialog'}
                options={options}
                workspaces={list ?? [options]}
                onWorkspaceChange={(workspaceKey) =>
                    setState({ ...state, workspaceKey })
                }
                defaults={state.defaults}
                today={today}
                currentUserId={auth.user?.id}
                canDelete={false}
                onDone={close}
            />
        ) : error ? (
            <p className="py-6 text-center text-[15px] text-danger">{error}</p>
        ) : list !== null ? (
            <p className="py-6 text-center text-[15px] text-text-muted">
                Anda belum menjadi anggota workspace yang bisa ditambah tugas.
            </p>
        ) : (
            <div className="space-y-3 py-2" aria-busy>
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-24 w-full" />
            </div>
        );

    return (
        <ComposerContext.Provider value={api}>
            {children}
            {breakpoint !== 'mobile' && (
                <TaskSheet
                    taskId={openTaskId}
                    today={today}
                    navigationIds={listContext?.ids ?? navigationIds}
                    onNavigate={setOpenTaskId}
                    onClose={() => setOpenTaskId(null)}
                    onTaskChange={listContext?.onTaskChange ?? onTaskChange}
                />
            )}
            {breakpoint === 'mobile' ? (
                <BottomSheet
                    open={state !== null}
                    onOpenChange={(open) => !open && close()}
                    title={title}
                >
                    {body}
                </BottomSheet>
            ) : (
                <Dialog
                    open={state !== null}
                    onOpenChange={(open) => !open && close()}
                >
                    <DialogContent className="bg-surface sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription className="sr-only">
                                Isi judul lalu atur status, prioritas,
                                penanggung jawab, tenggat, dan label.
                            </DialogDescription>
                        </DialogHeader>
                        {body}
                    </DialogContent>
                </Dialog>
            )}
        </ComposerContext.Provider>
    );
}
