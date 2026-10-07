import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
    notifyCommentsRead,
    useCommentReadEvents,
} from '../realtime/comment-reads';
import { taskApi } from './api';
import { readTarget } from './comment-reads';
import type { TaskDetailState } from './use-task-detail';
import type { TaskDetail } from './types';

/** Comments must stay on screen this long before they count as read. */
export const READ_DELAY_MS = 1200;

/** Is the element on screen (and the tab in front)? */
function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
    const [intersecting, setIntersecting] = useState(false);
    const [pageVisible, setPageVisible] = useState(
        () =>
            typeof document === 'undefined' ||
            document.visibilityState !== 'hidden',
    );

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            setIntersecting(true);

            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => setIntersecting(entry?.isIntersecting ?? false),
            // A sliver at the very bottom of the viewport does not count.
            { rootMargin: '0px 0px -10% 0px' },
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, [ref]);

    useEffect(() => {
        const update = () =>
            setPageVisible(document.visibilityState !== 'hidden');
        document.addEventListener('visibilitychange', update);

        return () => document.removeEventListener('visibilitychange', update);
    }, []);

    return intersecting && pageVisible;
}

/**
 * "Dibaca oleh" for the task detail: while the comment list is on screen,
 * reports (debounced) the newest comment of someone else the viewer has not
 * reached yet — one POST per new comment, never for own comments — and
 * applies `comment.read` events of the other people who have the task open.
 */
export function useCommentReads(
    state: TaskDetailState & { detail: TaskDetail },
    sectionRef: RefObject<HTMLElement | null>,
): void {
    const { detail, viewer, applyRead } = state;
    const taskId = detail.task.id;
    const onScreen = useOnScreen(sectionRef);
    const target = detail.can.track_reads
        ? readTarget(detail.timeline, detail.comment_reads, viewer?.id)
        : null;
    const sent = useRef<string | null>(null);
    // `applyRead` is a new function every render: keep the timer stable.
    const apply = useRef(applyRead);

    useEffect(() => {
        apply.current = applyRead;
    });

    useCommentReadEvents(taskId, viewer?.id, (event) => apply.current(event));

    useEffect(() => {
        if (!onScreen || !target || sent.current === target) {
            return;
        }

        const timer = window.setTimeout(() => {
            sent.current = target;
            void taskApi
                .markRead(taskId, target)
                .then(({ read }) => {
                    if (read) {
                        apply.current(read);
                    }

                    notifyCommentsRead(taskId);
                })
                .catch(() => {
                    // Not critical: try again with the next comment or visit.
                    sent.current = null;
                });
        }, READ_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [onScreen, target, taskId]);
}
