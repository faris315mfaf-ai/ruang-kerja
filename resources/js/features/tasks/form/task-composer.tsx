import { usePage } from '@inertiajs/react';
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
import type { Task, WorkspaceTaskOptions } from '../types';
import type { TaskFormDefaults } from './task-form';
import { TaskForm } from './task-form';
import { useFormOptions } from './use-form-options';

type ComposerState =
    | { mode: 'create'; defaults?: TaskFormDefaults; workspaceKey?: string }
    | { mode: 'edit'; task: Task; workspaceKey?: string };

type ComposerApi = {
    openCreate: (defaults?: TaskFormDefaults) => void;
    openEdit: (task: Task, workspaceKey?: string) => void;
    /** False when the user cannot create tasks here (viewer, archived). */
    canCreate: boolean;
};

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
    /** Edit rights for opened tasks (defaults to canCreate). */
    canEdit?: boolean;
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
    canEdit = canCreate,
}: Props) {
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const [state, setState] = useState<ComposerState | null>(null);
    const needsList =
        state !== null &&
        (workspace === undefined ||
            state.mode === 'create' ||
            (state.workspaceKey !== undefined &&
                state.workspaceKey !== workspace.key));
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
        openCreate: (defaults) => setState({ mode: 'create', defaults }),
        openEdit: (task, workspaceKey) =>
            setState({ mode: 'edit', task, workspaceKey }),
    };

    const key = state?.workspaceKey ?? workspace?.key ?? list?.[0]?.key;
    const options: WorkspaceTaskOptions | undefined =
        workspace && workspace.key === key
            ? workspace
            : list?.find((item) => item.key === key);
    const close = () => setState(null);
    const title =
        state?.mode === 'edit' ? `Ubah ${state.task.key}` : 'Tugas baru';

    const body =
        state === null ? null : options ? (
            <TaskForm
                key={state.mode === 'edit' ? state.task.id : 'create'}
                variant={breakpoint === 'mobile' ? 'sheet' : 'dialog'}
                options={options}
                workspaces={
                    state.mode === 'create' ? (list ?? [options]) : undefined
                }
                onWorkspaceChange={(workspaceKey) =>
                    setState({ ...state, workspaceKey })
                }
                task={state.mode === 'edit' ? state.task : undefined}
                defaults={state.mode === 'create' ? state.defaults : undefined}
                today={today}
                currentUserId={auth.user?.id}
                canDelete={state.mode === 'edit' && canEdit}
                onDone={close}
            />
        ) : error ? (
            <p className="py-6 text-center text-sm text-danger">{error}</p>
        ) : list !== null ? (
            <p className="py-6 text-center text-sm text-text-muted">
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
