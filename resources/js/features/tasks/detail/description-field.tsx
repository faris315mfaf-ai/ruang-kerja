import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RichTextView } from "../editor/rich-text-view";
import type { RichDoc, TaskReferenceInfo } from "../editor/types";
import { LazyRichTextEditor } from "./lazy-editor";

type Props = {
  value: RichDoc | null;
  references: Record<string, TaskReferenceInfo>;
  workspaceKey: string;
  editable: boolean;
  onSave: (doc: RichDoc | null) => Promise<boolean>;
  className?: string;
  /** Type size of the read-only text (page: body-lg, DTugas). */
  textClassName?: string;
};

/**
 * Description: read-only rich text; "Ubah" (or a click on the text) opens
 * the Tiptap editor. Cmd/Ctrl+Enter saves, Esc cancels.
 */
export function DescriptionField({
  value,
  references,
  workspaceKey,
  editable,
  onSave,
  className,
  textClassName,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RichDoc | null>(value);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);

    if (ok) {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div
        className={cn("space-y-2", className)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setEditing(false);
          }
        }}
      >
        <div className="min-h-32 rounded-control border border-primary bg-surface px-4 py-3 ring-4 ring-ring/55">
          <LazyRichTextEditor
            value={value}
            workspaceKey={workspaceKey}
            ariaLabel="Deskripsi tugas"
            placeholder="Tulis deskripsi… ketik @ untuk menyebut rekan, # untuk merujuk tugas"
            onChange={setDraft}
            onSubmit={() => void save()}
            autoFocus
            className="min-h-28"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-meta text-text-muted">
            ⌘ Enter untuk menyimpan · Esc untuk batal
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Batal
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group relative", className)}>
      <RichTextView
        doc={value}
        references={references}
        className={textClassName}
        empty={
          editable ? (
            <button
              type="button"
              onClick={start}
              className="w-full rounded-control py-1 text-left text-[16px] text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              Tambahkan deskripsi…
            </button>
          ) : (
            <p className="text-[16px] text-text-muted">Belum ada deskripsi.</p>
          )
        }
      />
      {editable && value && (
        <button
          type="button"
          onClick={start}
          aria-label="Ubah deskripsi"
          className="absolute -top-1 right-0 flex h-9 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-[14px] font-semibold text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:static max-md:mt-2 max-md:h-11 max-md:px-3 max-md:text-[15px] max-md:opacity-100"
        >
          <Pencil className="size-4" aria-hidden />
          Ubah
        </button>
      )}
    </div>
  );
}
