import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef } from 'react';
import type { StatusCategory } from '../types';

/**
 * Thin task event: ids and placement only. Removed members may still be
 * subscribed until they reload, so content (title, description, comments) is
 * never broadcast; subscribers refetch it through the authorized endpoints
 * (`fetchTaskCard`, task detail), which answer 404 once access is gone.
 */
export type TaskSignal = {
    id: string;
    workspace_id: string;
    parent_id: string | null;
    status_id: string;
    status_category: StatusCategory;
    position: number;
    updated_at: string | null;
};

export type CommentSignal = { task_id: string; comment: { id: string } };

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
    'task.created': { task: TaskSignal };
    'task.updated': { task: TaskSignal };
    'task.moved': { task: TaskSignal };
    'task.deleted': {
        task: { id: string; workspace_id: string; parent_id: string | null };
    };
    'comment.posted': CommentSignal;
    'comment.updated': CommentSignal;
    'comment.deleted': CommentSignal;
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
                    // Only the private channel: echo().leave() would also
                    // drop presence-workspace.{id} (board presence per card).
                    echo().leaveChannel(`private-${name}`);
                } else {
                    subscribers.set(name, left);
                }
            };
        } catch {
            return;
        }
    }, [workspaceId]);
}
