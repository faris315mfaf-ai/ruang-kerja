import { usePage } from '@inertiajs/react';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { isTypingTarget } from '../form/task-composer';
import type { Task } from '../types';
import type { QuickProperty } from './quick-property-dialog';
import { shortcutFor, stepId } from './keys';

type Options = {
    enabled: boolean;
    /** Element containing the cards/rows (`[data-task-id]`). */
    container: RefObject<HTMLElement | null>;
    tasks: Record<string, Task>;
    canEdit: boolean;
    onAssignMe: (task: Task, userId: string) => void;
};

function focusedTaskId(container: HTMLElement | null): string | null {
    const active = document.activeElement;

    if (!(active instanceof HTMLElement) || !container?.contains(active)) {
        return null;
    }

    return (
        active.closest<HTMLElement>('[data-task-id]')?.dataset.taskId ?? null
    );
}

/**
 * J/K (focus next/previous card or row in display order), A (assign me),
 * S/P/D (status, priority, due date dialog) and ? (help) on the board and
 * list. Enter, C and Shift+←/→ are handled by the cards and the composer.
 */
export function useTaskShortcuts({
    enabled,
    container,
    tasks,
    canEdit,
    onAssignMe,
}: Options) {
    const { auth } = usePage().props;
    const [help, setHelp] = useState(false);
    const [quick, setQuick] = useState<{
        property: QuickProperty;
        taskId: string;
    } | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat || isTypingTarget(event.target)) {
                return;
            }

            const action = shortcutFor(event);

            if (!action) {
                return;
            }

            if (action === 'help') {
                event.preventDefault();
                setHelp(true);

                return;
            }

            const root = container.current;
            const current = focusedTaskId(root);

            if (action === 'next' || action === 'previous') {
                const elements = Array.from(
                    root?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [],
                );
                const ids = elements.map(
                    (element) => element.dataset.taskId ?? '',
                );
                const next = stepId(ids, current, action === 'next' ? 1 : -1);
                const target = elements.find(
                    (element) => element.dataset.taskId === next,
                );

                if (target) {
                    event.preventDefault();
                    target.focus();
                    target.scrollIntoView({
                        block: 'nearest',
                        inline: 'nearest',
                    });
                }

                return;
            }

            const task = current ? tasks[current] : undefined;

            if (!task || !canEdit) {
                return;
            }

            event.preventDefault();

            if (action === 'assign-me' && auth.user) {
                onAssignMe(task, auth.user.id);
            } else if (
                action === 'status' ||
                action === 'priority' ||
                action === 'due'
            ) {
                setQuick({ property: action, taskId: task.id });
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled, container, tasks, canEdit, onAssignMe, auth.user]);

    return {
        help,
        setHelp,
        quick,
        quickTask: quick ? (tasks[quick.taskId] ?? null) : null,
        closeQuick: () => {
            const id = quick?.taskId;
            setQuick(null);

            // Back to the card so J/K continue from there.
            if (id) {
                requestAnimationFrame(() =>
                    container.current
                        ?.querySelector<HTMLElement>(`[data-task-id="${id}"]`)
                        ?.focus(),
                );
            }
        },
    };
}
