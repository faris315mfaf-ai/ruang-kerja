import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "../types";
import type { ChecklistEntry } from "./types";

type Props = {
  items: ChecklistEntry[];
  members: WorkspaceMember[];
  editable: boolean;
  mobile?: boolean;
  onAdd: (title: string) => void;
  onToggle: (item: ChecklistEntry, done: boolean) => void;
  onRename: (item: ChecklistEntry, title: string) => void;
  onDelete: (item: ChecklistEntry) => void;
};

function ItemRow({
  item,
  doneBy,
  editable,
  mobile,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistEntry;
  doneBy: WorkspaceMember | undefined;
  editable: boolean;
  mobile: boolean;
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  const commit = () => {
    setEditing(false);
    const title = draft.trim();

    if (title !== "" && title !== item.title) {
      onRename(title);
    } else {
      setDraft(item.title);
    }
  };

  return (
    <li
      className={cn(
        "group flex items-center gap-3.5 border-t border-divider",
        mobile ? "min-h-[50px]" : "min-h-[64px]",
      )}
    >
      <Checkbox
        checked={item.is_done}
        disabled={!editable}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={item.title}
      />
      {editing ? (
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by an explicit edit action
          autoFocus
          aria-label="Ubah item checklist"
          value={draft}
          maxLength={255}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              event.stopPropagation();
              setDraft(item.title);
              setEditing(false);
            }
          }}
          className="h-10 min-w-0 flex-1 rounded-control border border-primary bg-surface px-3 text-[17px] text-text ring-4 ring-ring/55 outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={!editable}
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 py-2 text-left text-[17px] disabled:cursor-default",
            item.is_done ? "text-text-muted line-through decoration-1" : "text-text",
          )}
        >
          {item.title}
        </button>
      )}
      {doneBy && item.is_done && (
        <UserAvatar name={doneBy.name} src={doneBy.avatar} className="size-7 text-[11px]" />
      )}
      {editable && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Hapus ${item.title}`}
          className={cn(
            "flex size-11 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 hover:text-danger focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
            !mobile && "opacity-0 group-hover:opacity-100",
          )}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

/** Checklist with progress, "Sembunyikan yang selesai", inline add/rename. */
export function ChecklistSection({
  items,
  members,
  editable,
  mobile = false,
  onAdd,
  onToggle,
  onRename,
  onDelete,
}: Props) {
  const [hideDone, setHideDone] = useState(mobile);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const done = items.filter((item) => item.is_done).length;
  const visible = hideDone ? items.filter((item) => !item.is_done) : items;
  const percent = items.length === 0 ? 0 : (done / items.length) * 100;

  if (items.length === 0 && !editable) {
    return null;
  }

  const submit = () => {
    const title = draft.trim();

    if (title !== "") {
      onAdd(title);
      setDraft("");
    }
  };

  return (
    <section
      aria-labelledby="task-checklist"
      className={cn(
        "rounded-panel border border-border bg-surface shadow-card",
        mobile ? "px-4 pt-3 pb-2" : "px-6 pt-5 pb-3",
      )}
    >
      <header className="flex min-h-11 items-center gap-3">
        <h2
          id="task-checklist"
          className={cn("font-bold text-text", mobile ? "text-[17px]" : "text-[21px] leading-7")}
        >
          Checklist
        </h2>
        <span className="ml-auto flex items-center gap-2">
          {!mobile && done > 0 && (
            <button
              type="button"
              onClick={() => setHideDone(!hideDone)}
              className="min-h-11 rounded-control px-2 text-[15px] font-medium text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              {hideDone ? "Tampilkan yang selesai" : "Sembunyikan yang selesai"}
            </button>
          )}
          {items.length > 0 && (
            <span className="text-[16px] font-bold text-link tnum">
              {mobile ? `${done}/${items.length}` : `${done} dari ${items.length}`}
            </span>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Tambah item checklist"
              className="flex size-11 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          )}
        </span>
      </header>
      {items.length > 0 && !mobile && (
        <span
          className="mt-2 mb-3 block h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres checklist"
        >
          <span
            className="block h-full rounded-full bg-grad-merek-x transition-[width] duration-200 ease-brand"
            style={{ width: `${percent}%` }}
          />
        </span>
      )}

      {mobile && done > 0 && (
        <button
          type="button"
          onClick={() => setHideDone(!hideDone)}
          className="flex min-h-11 w-full items-center gap-3 border-t border-divider text-[15px] text-text-muted"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !hideDone && "rotate-180")}
            aria-hidden
          />
          {hideDone ? `${done} item selesai lainnya` : "Sembunyikan yang selesai"}
          <span className="ml-auto font-semibold text-link">{hideDone ? "Tampilkan" : ""}</span>
        </button>
      )}

      <ul>
        {visible.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            doneBy={members.find((m) => m.id === item.done_by)}
            editable={editable}
            mobile={mobile}
            onToggle={(value) => onToggle(item, value)}
            onRename={(title) => onRename(item, title)}
            onDelete={() => onDelete(item)}
          />
        ))}
      </ul>

      {editable && (adding || items.length === 0) && (
        <form
          className="flex items-center gap-2 border-t border-divider pt-3 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            aria-label="Item checklist baru"
            placeholder="Tambah item, lalu Enter"
            value={draft}
            maxLength={255}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setAdding(false);
                setDraft("");
              }
            }}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3.5 text-[17px] text-text placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/55 focus-visible:outline-none md:text-[16px]",
            )}
          />
        </form>
      )}
    </section>
  );
}
