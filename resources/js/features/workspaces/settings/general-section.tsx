import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import InputError from "@/components/input-error";
import { Button } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { update } from "@/routes/workspaces";
import type { WorkspaceDetail } from "../types";
import { SettingsCard } from "./settings-card";

type Props = {
  workspace: WorkspaceDetail;
  editable: boolean;
};

const input = cn(fieldClasses, "h-11");

/** Pengaturan › Umum: name, key, description, visibility. */
export function GeneralSection({ workspace, editable }: Props) {
  const form = useForm({
    name: workspace.name,
    key: workspace.key,
    description: workspace.description ?? "",
    visibility: workspace.visibility,
  });
  const personal = workspace.type === "personal";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.submit(update(workspace.key), { preserveScroll: true });
  };

  return (
    <SettingsCard
      id="umum"
      title="Umum"
      description="Identitas workspace dan siapa yang dapat menemukannya."
    >
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 pb-6 md:px-7">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className="flex flex-col gap-2">
            <span className="text-label text-text">Nama workspace</span>
            <input
              className={input}
              value={form.data.name}
              disabled={!editable || personal}
              maxLength={120}
              onChange={(event) => form.setData("name", event.target.value)}
            />
            <InputError message={form.errors.name} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-label text-text">Key</span>
            <input
              className={cn(input, "font-mono uppercase")}
              value={form.data.key}
              disabled={!editable}
              maxLength={10}
              onChange={(event) => form.setData("key", event.target.value.toUpperCase())}
            />
            <InputError message={form.errors.key} />
          </label>
        </div>
        <p className="-mt-2 text-meta text-text-muted">
          Key menjadi awalan ID tugas, mis.{" "}
          <span className="font-mono text-text">{form.data.key || "KEY"}-21</span>. Mengubah key
          tetap mengarahkan tautan lama.
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-label text-text">Deskripsi</span>
          <textarea
            className={cn(input, "h-auto min-h-24 py-2.5")}
            value={form.data.description}
            disabled={!editable}
            onChange={(event) => form.setData("description", event.target.value)}
          />
          <InputError message={form.errors.description} />
        </label>
        {!personal && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-text">Visibilitas</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    "private",
                    "Private",
                    "Hanya anggota yang diundang dapat melihat dan menemukan workspace ini.",
                  ],
                  [
                    "internal",
                    "Internal",
                    "Semua karyawan dapat melihat tugas. Hanya anggota yang dapat mengedit.",
                  ],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                    form.data.visibility === value
                      ? "border-2 border-primary bg-link-soft"
                      : "border-border",
                    !editable && "cursor-default opacity-70",
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={form.data.visibility === value}
                    disabled={!editable}
                    onChange={() => form.setData("visibility", value)}
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-label text-text">{label}</span>
                    <span className="block text-meta text-text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {editable && (
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={!form.isDirty}
              onClick={() => form.reset()}
            >
              Batal
            </Button>
            <Button type="submit" disabled={form.processing || !form.isDirty}>
              Simpan perubahan
            </Button>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
