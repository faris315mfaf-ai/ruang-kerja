import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { RichDoc } from '../editor/types';
import { ApiError } from '../lib/api';
import { useConnectionMode, usePolling } from '../realtime/connection';
import { useWorkspaceEvents } from '../realtime/workspace-channel';
import type { Task } from '../types';
import type { TaskChanges } from './api';
import { taskApi } from './api';
import { upsertRead } from './comment-reads';
import { toggleReaction, upsertComment } from './timeline';
import type { CommentRead, TaskComment, TaskDetail } from './types';

type Options = {
    /** Server-rendered detail (full-screen page); otherwise fetched. */
    initial?: TaskDetail;
    /** Called with the fresh task after a change (keeps the board in sync without waiting for the socket). */
    onTaskChange?: (task: Task) => void;
    onDeleted?: () => void;
};

function message(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
}

/**
 * Data + mutations of one task detail (TaskSheet, full page, mobile). Keeps
 * itself fresh through the workspace channel (task.* and comment.* events)
 * and polls every 30 s while the WebSocket is unavailable.
 */
export function useTaskDetail(taskId: string | null, options: Options = {}) {
    const { auth } = usePage().props;
    const viewer = auth.user;
    const [detail, setDetail] = useState<TaskDetail | null>(
        options.initial ?? null,
    );
    const [error, setError] = useState<string | null>(null);
    const [deleted, setDeleted] = useState(false);
    const mode = useConnectionMode();
    const callbacks = useRef(options);
    const refreshTimer = useRef<number | null>(null);
    const loadedFor = useRef<string | null>(options.initial?.task.id ?? null);

    useEffect(() => {
        callbacks.current = options;
    });

    const load = useCallback(async (id: string) => {
        try {
            const data = await taskApi.detail(id);
            loadedFor.current = id;
            setDetail(data);
            setError(null);
        } catch (failure) {
            if (failure instanceof ApiError && failure.status === 404) {
                setDeleted(true);
            }

            setError(message(failure, 'Detail tugas gagal dimuat.'));
        }
    }, []);

    // (Re)load when the task changes; server props seed the first render.
    useEffect(() => {
        if (!taskId) {
            return;
        }

        if (options.initial && options.initial.task.id === taskId) {
            setDetail(options.initial);
            loadedFor.current = taskId;

            return;
        }

        if (loadedFor.current !== taskId) {
            setDetail(null);
            setDeleted(false);
            setError(null);
        }

        void load(taskId);
    }, [taskId, options.initial, load]);

    /** Debounced background refresh (bursts of events → one request). */
    const refresh = useCallback(() => {
        if (!taskId) {
            return;
        }

        if (refreshTimer.current !== null) {
            window.clearTimeout(refreshTimer.current);
        }

        refreshTimer.current = window.setTimeout(() => {
            refreshTimer.current = null;
            void load(taskId);
        }, 250);
    }, [taskId, load]);

    useEffect(
        () => () => {
            if (refreshTimer.current !== null) {
                window.clearTimeout(refreshTimer.current);
            }
        },
        [],
    );

    const isThis = (task: { id: string; parent_id?: string | null }) =>
        task.id === taskId || task.parent_id === taskId;

    const applyComment = (payload: {
        task_id: string;
        comment: TaskComment;
    }) => {
        if (payload.task_id === taskId) {
            setDetail((current) =>
                current
                    ? {
                          ...current,
                          timeline: upsertComment(
                              current.timeline,
                              payload.comment,
                          ),
                      }
                    : current,
            );
        }
    };

    // Events carry ids only: refetch the (authorized) detail when it concerns
    // this task; a 404 marks it gone (deleted or access lost).
    const onComment = ({ task_id }: { task_id: string }) =>
        task_id === taskId && refresh();

    useWorkspaceEvents(detail?.workspace.id, {
        'task.updated': ({ task }) => isThis(task) && refresh(),
        'task.moved': ({ task }) => isThis(task) && refresh(),
        'task.created': ({ task }) => task.parent_id === taskId && refresh(),
        'task.deleted': ({ task }) => {
            if (task.id === taskId) {
                setDeleted(true);
            } else if (detail?.subtasks.some((sub) => sub.id === task.id)) {
                refresh();
            }
        },
        'comment.posted': onComment,
        'comment.updated': onComment,
        'comment.deleted': onComment,
        // Task or comment attachments changed elsewhere: reload (authorized GET).
        'attachment.added': ({ task_id }) => task_id === taskId && refresh(),
        'attachment.removed': ({ task_id }) => task_id === taskId && refresh(),
    });

    usePolling(mode === 'polling' && taskId !== null && !deleted, refresh);

    /** Apply a change optimistically, send it, then reconcile. */
    const update = useCallback(
        async (changes: TaskChanges, optimistic?: Partial<TaskDetail>) => {
            if (!detail) {
                return false;
            }

            const before = detail;
            setDetail({
                ...detail,
                ...optimistic,
                task: {
                    ...detail.task,
                    ...(changes as Partial<TaskDetail['task']>),
                    ...optimistic?.task,
                },
            });

            try {
                const { task } = await taskApi.update(detail.task.id, changes);
                setDetail((current) =>
                    current
                        ? {
                              ...current,
                              // The response has no `description`: the optimistic one stays.
                              task: { ...current.task, ...task },
                          }
                        : current,
                );
                callbacks.current.onTaskChange?.(task);
                refresh();

                return true;
            } catch (failure) {
                setDetail(before);
                toast.error(message(failure, 'Perubahan gagal disimpan.'));

                return false;
            }
        },
        [detail, refresh],
    );

    const run = useCallback(
        async <T>(action: () => Promise<T>, fallback: string) => {
            try {
                const result = await action();
                refresh();

                return result;
            } catch (failure) {
                toast.error(message(failure, fallback));
                refresh();

                return null;
            }
        },
        [refresh],
    );

    const api = {
        update,
        reload: () => (taskId ? load(taskId) : Promise.resolve()),
        /** Debounced background reload (e.g. after attachments changed). */
        refresh,

        /** A read pointer moved (own request or `comment.read` event). */
        applyRead: (read: CommentRead) =>
            setDetail((current) => {
                if (!current) {
                    return current;
                }

                const reads = upsertRead(current.comment_reads, read);

                return reads === current.comment_reads
                    ? current
                    : { ...current, comment_reads: reads };
            }),

        toggleWatch: async () => {
            if (!detail || !viewer) {
                return;
            }

            const watching = !detail.watching;
            setDetail({
                ...detail,
                watching,
                watchers: watching
                    ? [
                          ...detail.watchers,
                          {
                              id: viewer.id,
                              name: viewer.name,
                              avatar: viewer.avatar ?? null,
                          },
                      ]
                    : detail.watchers.filter((p) => p.id !== viewer.id),
            });
            await run(
                () => taskApi.watch(detail.task.id, watching),
                'Gagal mengubah status pengamat.',
            );
        },

        addChecklistItem: async (title: string) => {
            if (!detail) {
                return;
            }

            const result = await run(
                () => taskApi.addChecklistItem(detail.task.id, title),
                'Item checklist gagal ditambahkan.',
            );

            if (result) {
                setDetail((current) =>
                    current
                        ? {
                              ...current,
                              checklist: [...current.checklist, result.item],
                          }
                        : current,
                );
            }
        },

        updateChecklistItem: async (
            itemId: string,
            changes: { title?: string; is_done?: boolean },
        ) => {
            setDetail((current) =>
                current
                    ? {
                          ...current,
                          checklist: current.checklist.map((item) =>
                              item.id === itemId
                                  ? { ...item, ...changes }
                                  : item,
                          ),
                      }
                    : current,
            );
            await run(
                () => taskApi.updateChecklistItem(itemId, changes),
                'Checklist gagal diperbarui.',
            );
        },

        deleteChecklistItem: async (itemId: string) => {
            setDetail((current) =>
                current
                    ? {
                          ...current,
                          checklist: current.checklist.filter(
                              (item) => item.id !== itemId,
                          ),
                      }
                    : current,
            );
            await run(
                () => taskApi.deleteChecklistItem(itemId),
                'Item checklist gagal dihapus.',
            );
        },

        createSubtask: async (title: string) => {
            if (!detail) {
                return;
            }

            const result = await run(
                () =>
                    taskApi.createSubtask(
                        detail.workspace.key,
                        detail.task.id,
                        title,
                    ),
                'Sub-tugas gagal dibuat.',
            );

            if (result) {
                callbacks.current.onTaskChange?.(result.task);
                setDetail((current) =>
                    current
                        ? {
                              ...current,
                              subtasks: [...current.subtasks, result.task],
                          }
                        : current,
                );
            }
        },

        /** Posts a comment; resolves to it (to attach files next) or null. */
        postComment: async (body: RichDoc): Promise<TaskComment | null> => {
            if (!detail) {
                return null;
            }

            try {
                const { comment } = await taskApi.postComment(
                    detail.task.id,
                    body,
                );
                applyComment({ task_id: detail.task.id, comment });
                refresh();

                return comment;
            } catch (failure) {
                toast.error(message(failure, 'Komentar gagal dikirim.'));

                return null;
            }
        },

        updateComment: async (commentId: string, body: RichDoc) => {
            if (!detail) {
                return false;
            }

            try {
                const { comment } = await taskApi.updateComment(
                    commentId,
                    body,
                );
                applyComment({ task_id: detail.task.id, comment });

                return true;
            } catch (failure) {
                toast.error(message(failure, 'Komentar gagal disimpan.'));

                return false;
            }
        },

        deleteComment: async (commentId: string) => {
            if (!detail) {
                return;
            }

            const result = await run(
                () => taskApi.deleteComment(commentId),
                'Komentar gagal dihapus.',
            );

            if (result) {
                applyComment({
                    task_id: detail.task.id,
                    comment: result.comment,
                });
                toast.success('Komentar dihapus.');
            }
        },

        react: async (comment: TaskComment, emoji: string) => {
            if (!detail || !viewer) {
                return;
            }

            applyComment({
                task_id: detail.task.id,
                comment: toggleReaction(comment, emoji, viewer.id, viewer.name),
            });

            try {
                const result = await taskApi.react(comment.id, emoji);
                applyComment({
                    task_id: detail.task.id,
                    comment: result.comment,
                });
            } catch (failure) {
                applyComment({ task_id: detail.task.id, comment });
                toast.error(message(failure, 'Reaksi gagal disimpan.'));
            }
        },

        deleteTask: async () => {
            if (!detail) {
                return false;
            }

            try {
                await taskApi.destroy(detail.task.id);
                toast.success(`Tugas ${detail.task.key} dihapus.`);
                setDeleted(true);
                callbacks.current.onDeleted?.();

                return true;
            } catch (failure) {
                toast.error(message(failure, 'Tugas gagal dihapus.'));

                return false;
            }
        },
    };

    return { detail, error, deleted, mode, viewer, ...api };
}

export type TaskDetailState = ReturnType<typeof useTaskDetail>;
