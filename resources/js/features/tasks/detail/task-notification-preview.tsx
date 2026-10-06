import { Link } from "@inertiajs/react";
import { ExternalLink } from "lucide-react";
import { PRIORITY_LABELS, PriorityIcon } from "@/components/priority-icon";
import { UserAvatar } from "@/components/shell/user-avatar";
import { StatusIcon } from "@/components/status-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationDetailProps } from "@/features/notifications/detail-renderers";
import { DueBadge } from "../due-badge";
import { RichTextView } from "../editor/rich-text-view";
import { officeToday } from "../lib/due-date";
import { ActivityRow } from "./activity-row";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";
import { commentCount } from "./timeline";
import { useTaskDetail } from "./use-task-detail";

const TASK_SUBJECT = "App\\Models\\Task";
const RECENT = 6;

/**
 * Rich task preview in the desktop Inbox (mockup Inbox): status, due date,
 * assignees, priority, the latest activity & comments, and a reply box —
 * live through the workspace channel.
 */
export function TaskNotificationPreview({ notification }: NotificationDetailProps) {
  const subject = notification.subject;
  const taskId = subject && subject.type === TASK_SUBJECT ? subject.id : null;
  const state = useTaskDetail(taskId);
  const { detail, viewer } = state;
  const today = officeToday();

  if (!taskId) {
    return null;
  }

  if (state.deleted) {
    return (
      <p className="text-[15px] text-text-muted">
        Tugas ini sudah dihapus atau Anda tidak lagi punya akses.
      </p>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-3" aria-busy aria-label="Memuat tugas">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const { task } = detail;
  const status = detail.statuses.find((item) => item.id === task.status_id);
  const recent = detail.timeline.slice(-RECENT);
  const names = Object.fromEntries(detail.members.map((m) => [m.id, m.name]));
  const highlight =
    typeof notification.meta.comment_id === "string" ? notification.meta.comment_id : null;
  const closed = task.status_category === "done" || task.status_category === "canceled";

  return (
    <div className="space-y-5">
      <section
        aria-label={`Tugas ${task.key}`}
        className="rounded-lg border border-border bg-surface p-5"
      >
        <div className="flex items-start gap-3">
          <StatusIcon category={task.status_category} color={status?.color} />
          <div className="min-w-0 flex-1">
            <Link href={detail.url} className="text-base font-semibold text-text hover:underline">
              {task.title}
            </Link>
            <RichTextView
              doc={task.description}
              references={detail.references}
              className="mt-1 line-clamp-3 text-[15px] text-text-muted"
            />
          </div>
          <span className="font-mono text-meta text-text-muted">{task.key}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-[15px] lg:grid-cols-4">
          <div>
            <dt className="text-meta text-text-muted">Status</dt>
            <dd className="mt-1 text-text">{status?.name ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-meta text-text-muted">Tenggat</dt>
            <dd className="mt-1">
              {task.due_date ? (
                <DueBadge
                  due={task.due_date}
                  today={today}
                  closed={closed}
                  className="text-[15px]"
                />
              ) : (
                "–"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-meta text-text-muted">Penanggung jawab</dt>
            <dd className="mt-1 flex flex-col gap-1">
              {detail.assignees.length === 0
                ? "–"
                : detail.assignees.map((person) => (
                    <span key={person.id} className="inline-flex items-center gap-1.5 text-text">
                      <UserAvatar
                        name={person.name}
                        src={person.avatar}
                        className="size-5 text-[9px]"
                      />
                      <span className="truncate">{person.name}</span>
                    </span>
                  ))}
            </dd>
          </div>
          <div>
            <dt className="text-meta text-text-muted">Prioritas</dt>
            <dd className="mt-1 inline-flex items-center gap-1.5 text-text">
              <PriorityIcon priority={task.priority} labelled={false} />
              {PRIORITY_LABELS[task.priority]}
            </dd>
          </div>
        </dl>
        {detail.checklist.length > 0 && (
          <p className="mt-4 border-t border-border pt-3 text-[15px] text-text-muted">
            Checklist {detail.checklist.filter((item) => item.is_done).length}/
            {detail.checklist.length}
          </p>
        )}
      </section>

      <section aria-labelledby="preview-activity" className="space-y-3">
        <h3
          id="preview-activity"
          className="flex items-center gap-2 text-[15px] font-medium text-text"
        >
          Aktivitas & komentar
          <span className="font-normal text-text-muted">
            {commentCount(detail.timeline)} komentar
          </span>
          <Link
            href={detail.url}
            className="ml-auto inline-flex items-center gap-1 text-meta font-normal text-link hover:underline"
          >
            Lihat semua
            <ExternalLink className="size-3" aria-hidden />
          </Link>
        </h3>
        <ol className="space-y-2.5">
          {recent.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              {item.kind === "activity" ? (
                <ActivityRow item={item} names={names} />
              ) : (
                <CommentItem
                  comment={item}
                  viewerId={viewer?.id}
                  canComment={detail.can.comment}
                  canModerate={detail.can.moderate}
                  workspaceKey={detail.workspace.key}
                  taskUrl={detail.url}
                  references={detail.references}
                  reactions={detail.reactions}
                  highlighted={item.id === highlight}
                  onEdit={(body) => state.updateComment(item.id, body)}
                  onDelete={() => void state.deleteComment(item.id)}
                  onReact={(emoji) => void state.react(item, emoji)}
                />
              )}
            </li>
          ))}
        </ol>
        {detail.can.comment && (
          <CommentComposer
            workspaceKey={detail.workspace.key}
            author={
              viewer
                ? {
                    name: viewer.name,
                    avatar: viewer.avatar ?? null,
                  }
                : null
            }
            onSubmit={state.postComment}
            placeholder={
              notification.actor
                ? `Balas ke ${notification.actor.name}… ketik @ untuk menyebut`
                : "Tulis komentar…"
            }
            hint={`Balasan juga muncul di ${task.key}`}
          />
        )}
      </section>
    </div>
  );
}
