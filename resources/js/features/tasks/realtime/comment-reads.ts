import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef } from 'react';
import type { CommentRead } from '../detail/types';
import { useTaskPresence } from './presence';

/** `comment.read` on `presence-task.{id}` (App\Events\Tasks\CommentsRead). */
export type CommentReadEvent = CommentRead & { task_id: string };

/**
 * Someone with the task open moved their read pointer ("Dibaca oleh").
 * Shares the presence subscription of useTaskPresence (joined first, so the
 * channel is left by the same reference count).
 */
export function useCommentReadEvents(
    taskId: string | null | undefined,
    viewerId: string | null | undefined,
    handler: (event: CommentReadEvent) => void,
): void {
    useTaskPresence(taskId, viewerId);
    const ref = useRef(handler);

    useEffect(() => {
        ref.current = handler;
    });

    useEffect(() => {
        if (!taskId || !echoIsConfigured()) {
            return;
        }

        const callback = (payload: CommentReadEvent) => {
            if (payload.task_id === taskId) {
                ref.current(payload);
            }
        };

        try {
            const channel = echo().join(`task.${taskId}`);
            channel.listen('.comment.read', callback);

            return () => {
                try {
                    channel.stopListening('.comment.read', callback);
                } catch {
                    // Channel already left.
                }
            };
        } catch {
            // No WebSocket: receipts refresh with the detail (polling).
            return;
        }
    }, [taskId]);
}

/*
 * Local signal "the viewer read the comments of task X", so a board behind
 * an open TaskSheet clears the card's unread dot without a refetch.
 */
const readListeners = new Set<(taskId: string) => void>();

export function notifyCommentsRead(taskId: string): void {
    readListeners.forEach((listener) => listener(taskId));
}

export function useCommentsReadSignal(handler: (taskId: string) => void): void {
    const ref = useRef(handler);

    useEffect(() => {
        ref.current = handler;
    });

    useEffect(() => {
        const listener = (taskId: string) => ref.current(taskId);
        readListeners.add(listener);

        return () => {
            readListeners.delete(listener);
        };
    }, []);
}
