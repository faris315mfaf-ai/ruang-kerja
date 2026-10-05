import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef } from 'react';
import type { TaskComment } from '../detail/types';
import type { Task } from '../types';

/** App\Events\Tasks\TaskAttachmentBroadcastEvent::broadcastWith(). */
export type AttachmentEventPayload = {
    task_id: string;
    attachable_type: 'task' | 'comment';
    attachable_id: string;
    attachment_id: string;
    /** Task-level attachments after the change. */
    attachments_count: number;
};

/** Payloads broadcast on `private-workspace.{id}` (App\Events\Tasks\*). */
export type WorkspaceEvents = {
    'task.created': { task: Task };
    'task.updated': { task: Task };
    'task.moved': { task: Task };
    'task.deleted': { task: { id: string; workspace_id: string } };
    'comment.posted': { task_id: string; comment: TaskComment };
    'comment.updated': { task_id: string; comment: TaskComment };
    'comment.deleted': { task_id: string; comment: TaskComment };
    'attachment.added': AttachmentEventPayload;
    'attachment.removed': AttachmentEventPayload;
};

export type WorkspaceEventName = keyof WorkspaceEvents;

export type WorkspaceEventHandlers = {
    [K in WorkspaceEventName]?: (payload: WorkspaceEvents[K]) => void;
};

export const WORKSPACE_EVENTS: WorkspaceEventName[] = [
    'task.created',
    'task.updated',
    'task.moved',
    'task.deleted',
    'comment.posted',
    'comment.updated',
    'comment.deleted',
    'attachment.added',
    'attachment.removed',
];

/** Subscribers per channel, so the board and an open sheet share one subscription. */
const subscribers = new Map<string, number>();

/**
 * Listens to the workspace channel while mounted. Several components may
 * subscribe to the same workspace; the channel is left when the last one
 * unmounts. Silently does nothing when Echo is not configured (polling
 * covers that case).
 */
export function useWorkspaceEvents(
    workspaceId: string | null | undefined,
    handlers: WorkspaceEventHandlers,
): void {
    const ref = useRef(handlers);

    useEffect(() => {
        ref.current = handlers;
    });

    useEffect(() => {
        if (!workspaceId || !echoIsConfigured()) {
            return;
        }

        const name = `workspace.${workspaceId}`;
        const callbacks = WORKSPACE_EVENTS.map((event) => {
            const callback = (payload: unknown) => {
                const handler = ref.current[event] as
                    | ((value: unknown) => void)
                    | undefined;
                handler?.(payload);
            };

            return [event, callback] as const;
        });

        try {
            const channel = echo().private(name);
            subscribers.set(name, (subscribers.get(name) ?? 0) + 1);
            callbacks.forEach(([event, callback]) =>
                channel.listen(`.${event}`, callback),
            );

            return () => {
                callbacks.forEach(([event, callback]) =>
                    channel.stopListening(`.${event}`, callback),
                );
                const left = (subscribers.get(name) ?? 1) - 1;

                if (left <= 0) {
                    subscribers.delete(name);
                    echo().leave(name);
                } else {
                    subscribers.set(name, left);
                }
            };
        } catch {
            return;
        }
    }, [workspaceId]);
}
