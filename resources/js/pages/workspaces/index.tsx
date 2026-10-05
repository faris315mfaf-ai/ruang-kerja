import { Head, Link, useForm } from '@inertiajs/react';
import { Plus, Users } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { clearFormOptionsCache } from '@/features/tasks/form/use-form-options';
import { groupByType } from '@/features/workspaces/lib';
import type { WorkspaceDetail } from '@/features/workspaces/types';
import { TYPE_GROUP_LABELS } from '@/features/workspaces/types';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { show, store } from '@/routes/workspaces';
import { usePage } from '@inertiajs/react';

type Row = WorkspaceDetail & { open_tasks_count: number; is_member: boolean };

type Props = {
    workspaces: Row[];
    can_create: { team: boolean; project: boolean };
    teams: { id: string; name: string }[];
};

const field =
    'h-10 w-full rounded-md border border-border bg-surface px-3 text-text placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

function CreateWorkspaceDialog({
    open,
    onOpenChange,
    can,
    teams,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    can: Props['can_create'];
    teams: Props['teams'];
}) {
    const form = useForm({
        type: can.project ? 'project' : 'team',
        name: '',
        key: '',
        description: '',
        visibility: 'private',
        team_id: '',
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
            <DialogContent className="bg-surface sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Workspace baru</DialogTitle>
                    <DialogDescription>
                        Workspace pribadi dan divisi dibuat otomatis. Di sini
                        Anda membuat workspace tim atau proyek.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <fieldset className="grid grid-cols-2 gap-2">
                        <legend className="sr-only">Jenis</legend>
                        {(['project', 'team'] as const).map((type) => (
                            <label
                                key={type}
                                className={cn(
                                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px]',
                                    form.data.type === type
                                        ? 'border-primary/60 bg-primary/5 text-text'
                                        : 'border-border text-text-muted',
                                    !can[type] &&
                                        'cursor-not-allowed opacity-50',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="type"
                                    value={type}
                                    checked={form.data.type === type}
                                    disabled={!can[type]}
                                    onChange={() => form.setData('type', type)}
                                    className="accent-primary"
                                />
                                {type === 'project' ? 'Proyek' : 'Tim'}
                            </label>
                        ))}
                    </fieldset>
                    <InputError message={form.errors.type} />
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                        <label className="space-y-1">
                            <span className="text-[13px] font-medium text-text">
                                Nama
                            </span>
                            <input
                                autoFocus
                                className={field}
                                value={form.data.name}
                                maxLength={120}
                                placeholder="mis. Proyek Peluncuran Q4"
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                            />
                            <InputError message={form.errors.name} />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[13px] font-medium text-text">
                                Key
                            </span>
                            <input
                                className={cn(field, 'font-mono uppercase')}
                                value={form.data.key}
                                maxLength={10}
                                placeholder="Otomatis"
                                onChange={(event) =>
                                    form.setData(
                                        'key',
                                        event.target.value.toUpperCase(),
                                    )
                                }
                            />
                            <InputError message={form.errors.key} />
                        </label>
                    </div>
                    {form.data.type === 'team' && teams.length > 0 && (
                        <label className="block space-y-1">
                            <span className="text-[13px] font-medium text-text">
                                Tautkan ke tim (anggota tersinkron)
                            </span>
                            <select
                                className={field}
                                value={form.data.team_id}
                                onChange={(event) =>
                                    form.setData('team_id', event.target.value)
                                }
                            >
                                <option value="">Tidak ditautkan</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="block space-y-1">
                        <span className="text-[13px] font-medium text-text">
                            Deskripsi{' '}
                            <span className="font-normal text-text-muted">
                                (opsional)
                            </span>
                        </span>
                        <textarea
                            className={cn(field, 'h-auto min-h-20 py-2')}
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                        />
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-text">
                        <input
                            type="checkbox"
                            checked={form.data.visibility === 'internal'}
                            onChange={(event) =>
                                form.setData(
                                    'visibility',
                                    event.target.checked
                                        ? 'internal'
                                        : 'private',
                                )
                            }
                            className="size-4 accent-primary"
                        />
                        Internal: semua karyawan dapat melihat (hanya anggota
                        yang mengubah)
                    </label>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                form.processing || form.data.name.trim() === ''
                            }
                        >
                            Buat workspace
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** /workspace: every workspace the user can see, grouped Pribadi · Divisi · Tim · Proyek. */
export default function WorkspaceIndex({
    workspaces,
    can_create,
    teams,
}: Props) {
    const [creating, setCreating] = useState(false);
    const { auth } = usePage().props;
    const canCreate = can_create.team || can_create.project;

    return (
        <>
            <Head title="Workspace" />
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="hidden text-xl leading-7 font-semibold text-text md:block">
                            Workspace
                        </h1>
                        <p className="text-[13px] text-text-muted">
                            Workspace yang bisa Anda buka. Bintangi dari sidebar
                            untuk menaruhnya di atas.
                        </p>
                    </div>
                    {canCreate && (
                        <Button
                            size="sm"
                            className="h-9 shrink-0"
                            onClick={() => setCreating(true)}
                        >
                            <Plus />
                            Workspace baru
                        </Button>
                    )}
                </header>

                {workspaces.length === 0 && (
                    <EmptyState
                        icon={Users}
                        title="Belum ada workspace"
                        description="Workspace pribadi Anda akan muncul di sini."
                    />
                )}

                {groupByType(workspaces).map((group) => (
                    <section key={group.type} className="space-y-2">
                        <h2 className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                            {TYPE_GROUP_LABELS[group.type]}
                        </h2>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {group.items.map((workspace) => (
                                <li key={workspace.id}>
                                    <Link
                                        href={show.url(workspace.key)}
                                        prefetch
                                        className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors duration-120 ease-brand hover:border-border-strong hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <WorkspaceAvatar
                                            name={workspace.name}
                                            type={workspace.type}
                                            color={workspace.color}
                                            ownerName={auth.user?.name}
                                            className="size-9 rounded-md text-sm"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="truncate text-[14px] font-medium text-text">
                                                    {workspace.type ===
                                                    'personal'
                                                        ? 'Pribadi'
                                                        : workspace.name}
                                                </span>
                                                {workspace.archived && (
                                                    <span className="rounded bg-surface-2 px-1.5 text-[11px] text-text-muted">
                                                        Diarsipkan
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block truncate text-[12px] text-text-muted">
                                                <span className="font-mono">
                                                    {workspace.key}
                                                </span>{' '}
                                                ·{' '}
                                                {workspace.visibility ===
                                                'internal'
                                                    ? 'Internal'
                                                    : 'Private'}{' '}
                                                ·{' '}
                                                {formatNumber(
                                                    workspace.open_tasks_count,
                                                )}{' '}
                                                tugas aktif
                                                {workspace.type !==
                                                    'personal' &&
                                                    ` · ${formatNumber(workspace.members_count)} anggota`}
                                                {!workspace.is_member &&
                                                    ' · bukan anggota'}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
            {canCreate && (
                <CreateWorkspaceDialog
                    open={creating}
                    onOpenChange={setCreating}
                    can={can_create}
                    teams={teams}
                />
            )}
        </>
    );
}

WorkspaceIndex.layout = {
    breadcrumbs: [{ title: 'Workspace', href: '/workspace' }],
};
