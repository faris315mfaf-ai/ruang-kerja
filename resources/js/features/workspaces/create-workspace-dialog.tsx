import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import InputError from "@/components/input-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fieldClasses, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio } from "@/components/ui/radio";
import { Textarea } from "@/components/ui/textarea";
import { clearFormOptionsCache } from "@/features/tasks/form/use-form-options";
import { cn } from "@/lib/utils";
import { store } from "@/routes/workspaces";

export type CreateAbilities = { team: boolean; project: boolean };

/** "Workspace baru": team or project workspace (personal/division are automatic). */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  can,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  can: CreateAbilities;
  teams: { id: string; name: string }[];
}) {
  const form = useForm({
    type: can.project ? "project" : "team",
    name: "",
    key: "",
    description: "",
    visibility: "private",
    team_id: "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(store.url(), {
      onSuccess: () => {
        clearFormOptionsCache();
        onOpenChange(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Workspace baru</DialogTitle>
          <DialogDescription>
            Workspace pribadi dan divisi dibuat otomatis. Di sini Anda membuat workspace tim atau
            proyek.
          </DialogDescription>
        </DialogHeader>
        <form id="create-workspace" onSubmit={submit} className="flex flex-col gap-4">
          <fieldset className="grid grid-cols-2 gap-2.5">
            <legend className="sr-only">Jenis</legend>
            {(["project", "team"] as const).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex min-h-13 cursor-pointer items-center gap-3 rounded-lg border px-4 text-[16px] font-semibold transition-colors duration-120 ease-brand",
                  form.data.type === type
                    ? "border-2 border-primary bg-link-soft text-text"
                    : "border-border text-text-muted",
                  !can[type] && "cursor-not-allowed opacity-50",
                )}
              >
                <Radio
                  name="type"
                  value={type}
                  checked={form.data.type === type}
                  disabled={!can[type]}
                  onChange={() => form.setData("type", type)}
                />
                {type === "project" ? "Proyek" : "Tim"}
              </label>
            ))}
          </fieldset>
          <InputError message={form.errors.type} />
          <div className="grid gap-3 sm:grid-cols-[1fr_128px]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-name">Nama</Label>
              <Input
                id="workspace-name"
                autoFocus
                value={form.data.name}
                maxLength={120}
                placeholder="mis. Proyek Peluncuran Q4"
                aria-invalid={Boolean(form.errors.name)}
                onChange={(event) => form.setData("name", event.target.value)}
              />
              <InputError message={form.errors.name} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-key">Key</Label>
              <Input
                id="workspace-key"
                className="font-mono uppercase"
                value={form.data.key}
                maxLength={10}
                placeholder="Otomatis"
                aria-invalid={Boolean(form.errors.key)}
                onChange={(event) => form.setData("key", event.target.value.toUpperCase())}
              />
              <InputError message={form.errors.key} />
            </div>
          </div>
          {form.data.type === "team" && teams.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-team">Tautkan ke tim (anggota tersinkron)</Label>
              <select
                id="workspace-team"
                className={cn(fieldClasses, "h-11")}
                value={form.data.team_id}
                onChange={(event) => form.setData("team_id", event.target.value)}
              >
                <option value="">Tidak ditautkan</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-description">
              Deskripsi <span className="font-normal text-text-muted">(opsional)</span>
            </Label>
            <Textarea
              id="workspace-description"
              value={form.data.description}
              onChange={(event) => form.setData("description", event.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-[22px] text-text">
            <Checkbox
              checked={form.data.visibility === "internal"}
              onCheckedChange={(checked) =>
                form.setData("visibility", checked === true ? "internal" : "private")
              }
            />
            Internal: semua karyawan dapat melihat (hanya anggota yang mengubah)
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            type="submit"
            form="create-workspace"
            disabled={form.processing || form.data.name.trim() === ""}
          >
            Buat workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
