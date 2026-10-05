import { router, usePage } from '@inertiajs/react';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { normalizeText } from '@/features/tasks/lib/filters';
import type { WorkspaceRole } from '@/features/tasks/types';
import { MemberDriveStatus } from '@/features/drive/drive-access-badge';
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
                    : `${members.length} anggota${divisions.size > 1 ? ` dari ${divisions.size} divisi` : ''}. Akses folder Drive mengikuti daftar ini.`
            }
        >
            {editable && (
                <div className="relative space-y-1.5 border-b border-border px-5 pb-6 md:px-7">
                    <label
                        htmlFor="invite-member"
                        className="text-label text-text"
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
                            className="h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3.5 text-[16px] text-text placeholder:text-text-subtle focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                        />
                        <select
                            aria-label="Peran"
                            value={role}
                            onChange={(event) =>
                                setRole(event.target.value as WorkspaceRole)
                            }
                            className={selectClass}
                        >
                            {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <Button
                            type="button"
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
                            className="absolute inset-x-5 top-full z-10 -mt-4 overflow-hidden rounded-lg border border-border bg-popover shadow-float md:inset-x-7"
                        >
                            {matches.map((candidate) => (
                                <li key={candidate.id}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={false}
                                        onClick={() => setSelected(candidate)}
                                        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-[15px] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                                    >
                                        <UserAvatar
                                            name={candidate.name}
                                            className="size-8 text-[12px]"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-text">
                                                {candidate.name}
                                            </span>
                                            <span className="block truncate text-meta text-text-muted">
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
                        <p className="text-meta text-text-muted">
                            Tidak ada karyawan aktif yang cocok (atau sudah
                            menjadi anggota).
                        </p>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                    <thead className="bg-background text-left text-meta text-text-muted">
                        <tr>
                            <th scope="col" className="px-5 py-3 font-semibold">
                                Nama
                            </th>
                            <th
                                scope="col"
                                className="hidden px-5 py-3 font-semibold md:table-cell"
                            >
                                Divisi
                            </th>
                            <th scope="col" className="px-5 py-3 font-semibold">
                                Peran
                            </th>
                            <th
                                scope="col"
                                className="hidden px-5 py-3 font-semibold md:table-cell"
                            >
                                Akses Drive
                            </th>
                            {editable && (
                                <th scope="col" className="w-14 px-2 py-3">
                                    <span className="sr-only">Aksi</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {shown.map((member) => {
                            const owner = member.role === 'owner';

                            return (
                                <tr key={member.id}>
                                    <td className="px-5 py-3.5">
                                        <span className="flex items-center gap-2.5">
                                            <UserAvatar
                                                name={member.name}
                                                src={member.avatar}
                                                className="size-10 text-[14px]"
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
                                                <span className="flex min-w-0 items-center gap-1 truncate text-meta text-text-muted">
                                                    {member.position && (
                                                        <span className="truncate">
                                                            {member.position}
                                                        </span>
                                                    )}
                                                    {member.position && (
                                                        <span aria-hidden>
                                                            ·
                                                        </span>
                                                    )}
                                                    {member.is_synced ? (
                                                        <span className="inline-flex shrink-0 items-center gap-0.5 text-success">
                                                            <RefreshCw
                                                                className="size-3"
                                                                aria-hidden
                                                            />
                                                            Sinkron{' '}
                                                            {workspace.type ===
                                                            'team'
                                                                ? 'tim'
                                                                : 'divisi'}
                                                        </span>
                                                    ) : (
                                                        <span className="shrink-0">
                                                            Diundang
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </span>
                                    </td>
                                    <td className="hidden px-5 py-3.5 text-text-muted md:table-cell">
                                        {member.division ?? '–'}
                                    </td>
                                    <td className="px-5 py-3.5">
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
                                                        {
                                                            preserveScroll: true,
                                                        },
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
                                    <td className="hidden px-5 py-3.5 md:table-cell">
                                        <MemberDriveStatus
                                            drive={member.drive}
                                        />
                                    </td>
                                    {editable && (
                                        <td className="px-3 py-3.5 text-right">
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
                                                    className="flex size-10 items-center justify-center rounded-control text-text-subtle hover:bg-surface-2 hover:text-danger focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <X className="size-5" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-divider px-5 py-3.5 text-meta text-text-muted md:px-7">
                {members.length > VISIBLE ? (
                    <button
                        type="button"
                        className="font-semibold text-link hover:underline"
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
