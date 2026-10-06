import { router } from "@inertiajs/react";
import { Plus, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LabelPill } from "@/features/tasks/label-pill";
import type { PaletteColor } from "@/lib/palette";
import { destroy, store, update } from "@/routes/workspaces/labels";
import type { LabelWithCount, WorkspaceDetail } from "../types";
import { ColorSelect } from "./color-select";
import { SettingsCard } from "./settings-card";

type Props = {
  workspace: WorkspaceDetail;
  labels: LabelWithCount[];
  editable: boolean;
};

type Draft = { id: string | null; name: string; color: PaletteColor };

/** Pengaturan › Label: pills with active-task counts; add, rename, recolor, delete. */
export function LabelsSection({ workspace, labels, editable }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!draft) {
      return;
    }

    const options = {
      preserveScroll: true,
      onSuccess: () => {
        setDraft(null);
        setError(null);
      },
      onError: (errors: Record<string, string>) =>
        setError(errors.name ?? errors.color ?? "Label gagal disimpan."),
    };
    const data = { name: draft.name.trim(), color: draft.color };

    if (draft.id) {
      router.patch(update.url({ workspace: workspace.key, label: draft.id }), data, options);
    } else {
      router.post(store.url(workspace.key), data, options);
    }
  };

  return (
    <SettingsCard
      id="label"
      title="Label"
      description="Label hanya berlaku di workspace ini. Angka = jumlah tugas aktif."
    >
      <div className="space-y-3 px-5 pb-6 md:px-7">
        <div className="flex flex-wrap gap-2">
          {labels.length === 0 && <p className="text-[15px] text-text-muted">Belum ada label.</p>}
          {labels.map((label) =>
            editable ? (
              <button
                key={label.id}
                type="button"
                onClick={() =>
                  setDraft({
                    id: label.id,
                    name: label.name,
                    color: label.color,
                  })
                }
                className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Ubah label ${label.name}`}
              >
                <LabelPill
                  label={label}
                  count={label.tasks_count}
                  className="h-8 px-3 text-[14px] hover:border-border-strong"
                />
              </button>
            ) : (
              <LabelPill
                key={label.id}
                label={label}
                count={label.tasks_count}
                className="h-8 px-3 text-[14px]"
              />
            ),
          )}
          {editable && !draft && (
            <button
              type="button"
              onClick={() => setDraft({ id: null, name: "", color: "teal" })}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border-strong px-3 text-[14px] text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              <Plus className="size-3.5" />
              Tambah label
            </button>
          )}
        </div>
        {draft && (
          <form
            onSubmit={submit}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-3"
          >
            <ColorSelect
              label="Warna label"
              value={draft.color}
              onChange={(color) => setDraft({ ...draft, color })}
            />
            <input
              autoFocus
              aria-label="Nama label"
              value={draft.name}
              maxLength={50}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Nama label"
              className="h-11 min-w-40 flex-1 rounded-control border border-border-strong bg-surface px-3.5 text-[16px] text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            />
            <Button type="submit" size="sm" disabled={draft.name.trim() === ""}>
              {draft.id ? "Simpan" : "Tambah"}
            </Button>
            {draft.id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() =>
                  draft.id &&
                  router.delete(
                    destroy.url({
                      workspace: workspace.key,
                      label: draft.id,
                    }),
                    {
                      preserveScroll: true,
                      onSuccess: () => setDraft(null),
                    },
                  )
                }
              >
                <Trash2 />
                Hapus
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="Batal"
              onClick={() => setDraft(null)}
            >
              <X />
            </Button>
            {error && <p className="w-full text-meta text-danger">{error}</p>}
          </form>
        )}
      </div>
    </SettingsCard>
  );
}
