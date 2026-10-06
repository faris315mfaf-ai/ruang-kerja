import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ActivityRow } from "./activity-row";
import { CommentItem } from "./comment-item";
import { commentCount } from "./timeline";
import type { TaskDetailState } from "./use-task-detail";
import type { TaskDetail } from "./types";

type Props = {
  state: TaskDetailState & { detail: TaskDetail };
  mobile?: boolean;
};

/** Unified activity + comment timeline with "Semua / Komentar" switch. */
export function TimelineSection({ state, mobile = false }: Props) {
  const { detail, viewer } = state;
  const [filter, setFilter] = useState<"all" | "comments">("all");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const names = Object.fromEntries(detail.members.map((m) => [m.id, m.name]));
  const items =
    filter === "all" ? detail.timeline : detail.timeline.filter((item) => item.kind === "comment");
  const comments = commentCount(detail.timeline);

  // Deep link "#komentar-{id}" (notifications): scroll to it and highlight.
  useEffect(() => {
    const hash = window.location.hash;

    if (!hash.startsWith("#komentar-")) {
      return;
    }

    const id = hash.slice("#komentar-".length);
    const element = document.getElementById(`komentar-${id}`);

    if (element) {
      element.scrollIntoView({ block: "center" });
      setHighlighted(id);
      const timer = window.setTimeout(() => setHighlighted(null), 2500);

      return () => window.clearTimeout(timer);
    }
  }, [detail.task.id]);

  return (
    <section aria-labelledby="task-activity" className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2
          id="task-activity"
          className={cn("font-bold text-text", mobile ? "text-[17px]" : "text-[21px] leading-7")}
        >
          {mobile ? "Aktivitas" : "Komentar & aktivitas"}
        </h2>
        <div
          role="tablist"
          aria-label="Filter aktivitas"
          className="ml-auto inline-flex gap-1 rounded-[14px] bg-surface-2 p-1"
        >
          {(["all", "comments"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-[10px] px-3.5 text-[15px] font-semibold transition-colors duration-120 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
                mobile ? "h-10" : "h-[34px]",
                filter === value
                  ? "bg-surface text-text shadow-segment"
                  : "text-text-muted hover:text-text",
              )}
            >
              {value === "all" ? "Semua" : `Komentar${comments > 0 ? ` ${comments}` : ""}`}
            </button>
          ))}
        </div>
      </header>

      {items.length === 0 ? (
        <p className="py-2 text-[15px] text-text-muted">
          Belum ada komentar. Mulai diskusi di bawah.
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item) => (
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
                  highlighted={highlighted === item.id}
                  mobile={mobile}
                  onEdit={(body) => state.updateComment(item.id, body)}
                  onDelete={() => void state.deleteComment(item.id)}
                  onReact={(emoji) => void state.react(item, emoji)}
                  onAttachmentsChange={state.refresh}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
