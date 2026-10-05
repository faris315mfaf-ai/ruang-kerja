import { router, usePage } from '@inertiajs/react';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { normalizeText } from '@/features/tasks/lib/filters';
import type { WorkspaceRole } from '@/features/tasks/types';
import { cn } from '@/lib/utils';
import { destroy, store, update } from '@/routes/workspaces/members';
import type {
    MemberCandidate,
    MemberDetail,
    Option,
    WorkspaceDetail,
} from '../types';
import { ROLE_LABELS } from '../types';
import { SettingsCard, selectClass } from './settings-card';

type Props = {
    workspace: WorkspaceDetail;
    members: MemberDetail[];
    candidates: MemberCandidate[];
    roleOptions: Option<WorkspaceRole>[];
    editable: boolean;
};

const VISIBLE = 8;

/** Pengaturan › Anggota: invite, role per member, remove (manual members only). */
export function MembersSection({
    workspace,
    members,
    candidates,
    roleOptions,
    editable,
}: Props) {
    const { auth } = usePage().props;
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<MemberCandidate | null>(null);
    const [role, setRole] = useState<WorkspaceRole>('member');
    const [showAll, setShowAll] = useState(false);
    const [processing, setProcessing] = useState(false);
    const needle = normalizeText(query.trim());
    const matches =
        needle === '' || selected
            ? []
            : candidates
                  .filter((candidate) =>
                      normalizeText(
                          `${candidate.name} ${candidate.email}`,
                      ).includes(needle),
                  )
                  .slice(0, 6);
    const divisions = new Set(
        members.map((member) => member.division).filter(Boolean),
    );
    const shown = showAll ? members : members.slice(0, VISIBLE);

    const invite = () => {
        if (!selected) {
            return;
        }

        setProcessing(true);
        router.post(
            store.url(workspace.key),
            { user_id: selected.id, role },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelected(null);
                    setQuery('');
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <SettingsCard
            id="anggota"
            title="Anggota"
            description={
                workspace.type === 'personal'
                    ? 'Workspace pribadi hanya bisa dibuka oleh Anda.'
                    : `${members.length} anggota${divisions.size > 1 ? ` dari ${divisions.size} divisi` : ''}. Akses folder Drive akan mengikuti daftar ini.`
            }
        >
            {editable && (
                <div className="relative space-y-1.5 border-b border-border p-4">
                    <label
                        htmlFor="invite-member"
                        className="text-[13px] font-medium text-text"
                    >
                        Undang anggota
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="invite-member"
                            value={selected ? selected.name : query}
                            onChange={(event) => {
                                setSelected(null);
                                setQuery(event.target.value);
                            }}
                            placeholder="Ketik nama atau email karyawan"
                            autoComplete="off"
                            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-[13px] text-text placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        />
                        <select
                            aria-label="Peran"
                            value={role}
                            onChange={(event) =>
                                setRole(event.target.value as WorkspaceRole)
                            }
                            className={cn(selectClass, 'h-9')}
                        >
                            {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <Button
                            type="button"
                            className="h-9"
                            disabled={!selected || processing}
                            onClick={invite}
                        >
                            Undang
                        </Button>
                    </div>
                    {matches.length > 0 && (
                        <ul
                            role="listbox"
                            aria-label="Karyawan"
                            className="absolute inset-x-4 top-full z-10 -mt-2 overflow-hidden rounded-md border border-border bg-popover shadow-card"
                        >
                            {matches.map((candidate) => (
                                <li key={candidate.id}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={false}
                                        onClick={() => setSelected(candidate)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                                    >
                                        <UserAvatar
                                            name={candidate.name}
                                            className="size-6 text-[10px]"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-text">
                                                {candidate.name}
                                            </span>
                                            <span className="block truncate text-[12px] text-text-muted">
                                                {candidate.email}
                                                {candidate.division
                                                    ? ` · ${candidate.division}`
                                                    : ''}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {needle !== '' && !selected && matches.length === 0 && (
                        <p className="text-[12px] text-text-muted">
                            Tidak ada karyawan aktif yang cocok (atau sudah
                            menjadi anggota).
                        </p>
                    )}
                </div>
            )}

            <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-left text-[12px] text-text-muted">
                    <tr>
                        <th scope="col" className="px-4 py-2 font-medium">
                            Nama
                        </th>
                        <th
                            scope="col"
                            className="hidden px-4 py-2 font-medium md:table-cell"
                        >
                            Divisi
                        </th>
                        <th scope="col" className="px-4 py-2 font-medium">
                            Peran
                        </th>
                        <th
                            scope="col"
                            className="hidden px-4 py-2 font-medium md:table-cell"
                        >
                            Sumber
                        </th>
                        {editable && (
                            <th scope="col" className="w-10 px-2 py-2">
                                <span className="sr-only">Aksi</span>
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {shown.map((member) => {
                        const owner = member.role === 'owner';

                        return (
                            <tr key={member.id}>
                                <td className="px-4 py-2.5">
                                    <span className="flex items-center gap-2.5">
                                        <UserAvatar
                                            name={member.name}
                                            src={member.avatar}
                                            className="size-7 text-[10px]"
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-text">
                                                {member.name}
                                                {member.id ===
                                                    auth.user?.id && (
                                                    <span className="text-text-muted">
                                                        {' '}
                                                        (Anda)
                                                    </span>
                                                )}
                                            </span>
                                            {member.position && (
                                                <span className="block truncate text-[12px] text-text-muted">
                                                    {member.position}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                </td>
                                <td className="hidden px-4 py-2.5 text-text-muted md:table-cell">
                                    {member.division ?? '–'}
                                </td>
                                <td className="px-4 py-2.5">
                                    {editable && !owner ? (
                                        <select
                                            aria-label={`Peran ${member.name}`}
                                            value={member.role}
                                            onChange={(event) =>
                                                router.patch(
                                                    update.url({
                                                        workspace:
                                                            workspace.key,
                                                        member: member.id,
                                                    }),
                                                    {
                                                        role: event.target
                                                            .value,
                                                    },
                                                    { preserveScroll: true },
                                                )
                                            }
                                            className={selectClass}
                                        >
                                            {roleOptions.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-text">
                                            {ROLE_LABELS[member.role]}
                                        </span>
                                    )}
                                </td>
                                <td className="hidden px-4 py-2.5 md:table-cell">
                                    {member.is_synced ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[12px] text-success">
                                            <RefreshCw
                                                className="size-3"
                                                aria-hidden
                                            />
                                            Sinkron{' '}
                                            {workspace.type === 'team'
                                                ? 'tim'
                                                : 'divisi'}
                                        </span>
                                    ) : (
                                        <span className="text-[12px] text-text-muted">
                                            Diundang
                                        </span>
                                    )}
                                </td>
                                {editable && (
                                    <td className="px-2 py-2.5 text-right">
                                        {!owner && !member.is_synced && (
                                            <button
                                                type="button"
                                                aria-label={`Keluarkan ${member.name}`}
                                                onClick={() =>
                                                    router.delete(
                                                        destroy.url({
                                                            workspace:
                                                                workspace.key,
                                                            member: member.id,
                                                        }),
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                className="rounded p-1 text-text-subtle hover:bg-surface-2 hover:text-danger focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-[12px] text-text-muted">
                {members.length > VISIBLE ? (
                    <button
                        type="button"
                        className="font-medium text-text hover:underline"
                        onClick={() => setShowAll((value) => !value)}
                    >
                        {showAll
                            ? 'Tampilkan lebih sedikit'
                            : `Tampilkan ${members.length - VISIBLE} anggota lainnya`}
                    </button>
                ) : (
                    <span />
                )}
                <span>Viewer hanya dapat membaca tugas dan file.</span>
            </div>
        </SettingsCard>
    );
}
