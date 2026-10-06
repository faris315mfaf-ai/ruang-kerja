import { Plus } from "lucide-react";
import { useState } from "react";
import { PriorityIcon } from "@/components/priority-icon";
import { UserAvatar } from "@/components/shell/user-avatar";
import { StatusIcon } from "@/components/status-icon";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "../lib/due-date";
import type { Task, TaskStatus, WorkspaceMember } from "../types";

type Props = {
  subtasks: Task[];
  statuses: TaskStatus[];
  members: WorkspaceMember[];
  editable: boolean;
  mobile?: boolean;
  onOpen: (task: Task) => void;
  onCreate: (title: string) => void;
};

/** Sub-tasks "1/3" with status, key, title, due and assignee (mockup TaskDetail). */
export function SubtasksSection({
  subtasks,
  statuses,
  members,
  editable,
  mobile = false,
  onOpen,
  onCreate,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const done = subtasks.filter((t) => t.status_category === "done").length;

  if (subtasks.length === 0 && !editable) {
    return null;
  }

  return (
    <section
      aria-labelledby="task-subtasks"
      className={cn(
        "rounded-panel border border-border bg-surface shadow-card",
        mobile ? "px-4 pt-3 pb-2" : "px-6 pt-5 pb-3",
      )}
    >
      <header className="flex min-h-11 items-center gap-2">
        <h2
          id="task-subtasks"
          className={cn("font-bold text-text", mobile ? "text-[17px]" : "text-[21px] leading-7")}
        >
          Sub-tugas
        </h2>
        {subtasks.length > 0 && (
          <span className="ml-auto text-[16px] font-bold text-link tnum">
            {done}/{subtasks.length}
          </span>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Tambah sub-tugas"
            className={cn(
              "flex size-11 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
              subtasks.length === 0 && "ml-auto",
            )}
          >
            <Plus className="size-5" aria-hidden />
          </button>
        )}
      </header>

      {subtasks.length > 0 && (
        <ul className="mt-1">
          {subtasks.map((task) => {
            const status = statuses.find((s) => s.id === task.status_id);
            const assignee = members.find((m) => task.assignee_ids.includes(m.id));
            const closed = task.status_category === "done";

            return (
              <li key={task.id} className="border-t border-divider">
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-control text-left hover:bg-surface-2/60 focus-visible:bg-surface-2 focus-visible:outline-none",
                    mobile ? "min-h-14 py-2" : "min-h-[60px] py-2",
                  )}
                >
                  <StatusIcon
                    category={task.status_category}
                    color={status?.color}
                    label={status?.name}
                    className="size-5"
                  />
                  {!mobile && (
                    <span className="w-20 shrink-0 font-mono text-[14px] font-semibold text-text-muted">
                      {task.key}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate",
                        "text-[17px] font-semibold",
                        closed ? "text-text-muted" : "text-text",
                      )}
                    >
                      {task.title}
                    </span>
                    {mobile && (
                      <span className="block font-mono text-[14px] text-text-muted">
                        {task.key}
                        {task.due_date && ` · ${formatDayMonth(task.due_date)}`}
                      </span>
                    )}
                  </span>
                  {task.priority !== 0 && (
                    <PriorityIcon priority={task.priority} labelled={false} />
                  )}
                  {!mobile && task.due_date && (
                    <span className="text-[15px] text-text-muted">
                      {closed && task.completed_at
                        ? `Selesai ${formatDayMonth(task.completed_at.slice(0, 10))}`
                        : formatDayMonth(task.due_date)}
                    </span>
                  )}
                  {assignee && (
                    <UserAvatar
                      name={assignee.name}
                      src={assignee.avatar}
                      className="size-[30px] text-[12px]"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editable && adding && (
        <form
          className="flex items-center gap-2 border-t border-divider pt-3 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            const title = draft.trim();

            if (title !== "") {
              onCreate(title);
              setDraft("");
            }
          }}
        >
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the "+" button
            autoFocus
            aria-label="Judul sub-tugas"
            placeholder="Judul sub-tugas, lalu Enter"
            value={draft}
            maxLength={255}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setAdding(false);
              }
            }}
            onBlur={() => draft.trim() === "" && setAdding(false)}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3.5 text-[17px] text-text placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/55 focus-visible:outline-none md:text-[16px]",
            )}
          />
        </form>
      )}
    </section>
  );
}
