import { Head, usePage } from '@inertiajs/react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { MemberDriveStatus } from '@/features/drive/drive-access-badge';
import { UserAvatar } from '@/components/shell/user-avatar';
import type { StatusCategory, WorkspaceRole } from '@/features/tasks/types';
import { DangerSection } from '@/features/workspaces/settings/danger-section';
import { DriveSection } from '@/features/workspaces/settings/drive-section';
import type { WorkspaceDriveSettings } from '@/features/workspaces/settings/drive-section';
import { GeneralSection } from '@/features/workspaces/settings/general-section';
import { LabelsSection } from '@/features/workspaces/settings/labels-section';
import { MembersSection } from '@/features/workspaces/settings/members-section';
import { StatusesSection } from '@/features/workspaces/settings/statuses-section';
import { workspaceLayout } from '@/features/workspaces/tab-layout';
import type {
    LabelWithCount,
    MemberCandidate,
    MemberDetail,
    Option,
    StatusWithCount,
    WorkspacePageProps,
} from '@/features/workspaces/types';
import { ROLE_LABELS } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = WorkspacePageProps & {
    member_details: MemberDetail[];
    statuses: StatusWithCount[];
    labels: LabelWithCount[];
    candidates: MemberCandidate[];
    role_options: Option<WorkspaceRole>[];
    category_options: Option<StatusCategory>[];
    drive: WorkspaceDriveSettings;
};

const NAV = [
    ['umum', 'Umum'],
    ['anggota', 'Anggota'],
    ['kolom-status', 'Kolom status'],
    ['label', 'Label'],
    ['integrasi-drive', 'Integrasi Drive'],
] as const;

/** Mobile: members are readable, the rest is desktop only (docs/PLATFORM.md §3 ◐). */
function MobileSettings({ members }: { members: MemberDetail[] }) {
    const { auth } = usePage().props;

    return (
        <div className="space-y-4">
            <DesktopOnlyNotice feature="Pengaturan nama, key, kolom status, label, dan anggota" />
            <p className="text-sm text-text-muted">
                Daftar anggota bisa dilihat di sini.
            </p>
            <section className="space-y-2">
                <h2 className="text-[15px] font-medium text-text">
                    Anggota · {members.length}
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {members.map((member) => (
                        <li
                            key={member.id}
                            className="flex min-h-14 items-center gap-3 px-4 py-2"
                        >
                            <UserAvatar
                                name={member.name}
                                src={member.avatar}
                                className="size-9 text-xs"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] text-text">
                                    {member.name}
                                    {member.id === auth.user?.id && (
                                        <span className="text-text-muted">
                                            {' '}
                                            (Anda)
                                        </span>
                                    )}
                                </span>
                                <span className="block truncate text-[13px] text-text-muted">
                                    {member.division ?? member.position ?? '–'}
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-[13px] text-text-muted">
                                    {ROLE_LABELS[member.role]}
                                </span>
                                <MemberDriveStatus drive={member.drive} />
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

/** Tab Pengaturan (mockup WorkspacePengaturan). */
export default function WorkspaceSettings(props: Props) {
    const {
        workspace,
        can,
        member_details,
        statuses,
        labels,
        candidates,
        role_options,
        category_options,
        drive,
    } = props;
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const editable = can.manage;
    const myRole = props.members.find(
        (member) => member.id === auth.user?.id,
    )?.role;

    return (
        <>
            <Head title={`${workspace.name} · Pengaturan`} />
            <WorkspaceShell {...props} tab="settings">
                {breakpoint === 'mobile' ? (
                    <MobileSettings members={member_details} />
                ) : (
                    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,760px)]">
                        <nav
                            aria-label="Bagian pengaturan"
                            className="hidden lg:block"
                        >
                            <ul className="sticky top-20 space-y-0.5">
                                {NAV.filter(
                                    ([id]) =>
                                        id !== 'anggota' ||
                                        workspace.type !== 'personal',
                                ).map(([id, label]) => (
                                    <li key={id}>
                                        <a
                                            href={`#${id}`}
                                            className="flex h-8 items-center justify-between rounded-md px-2.5 text-[13px] text-text-muted hover:bg-surface-2 hover:text-text"
                                        >
                                            {label}
                                            {id === 'anggota' && (
                                                <span className="text-[12px] tnum">
                                                    {member_details.length}
                                                </span>
                                            )}
                                            {id === 'integrasi-drive' &&
                                                drive.access.state ===
                                                    'synced' && (
                                                    <span
                                                        aria-label="Tersinkron"
                                                        className="size-1.5 rounded-full bg-success"
                                                    />
                                                )}
                                        </a>
                                    </li>
                                ))}
                                {can.archive && (
                                    <li className="mt-2 border-t border-border pt-2">
                                        <a
                                            href="#zona-bahaya"
                                            className="flex h-8 items-center rounded-md px-2.5 text-[13px] text-danger hover:bg-danger/10"
                                        >
                                            Zona bahaya
                                        </a>
                                    </li>
                                )}
                            </ul>
                        </nav>
                        <div className="space-y-8">
                            {myRole && (
                                <p className="text-right text-[13px] text-text-muted">
                                    Anda:{' '}
                                    <span className="font-medium text-text">
                                        {ROLE_LABELS[myRole]}
                                    </span>
                                </p>
                            )}
                            <GeneralSection
                                workspace={workspace}
                                editable={editable}
                            />
                            {workspace.type !== 'personal' && (
                                <MembersSection
                                    workspace={workspace}
                                    members={member_details}
                                    candidates={candidates}
                                    roleOptions={role_options}
                                    editable={can.manage_members}
                                />
                            )}
                            <StatusesSection
                                workspace={workspace}
                                statuses={statuses}
                                categoryOptions={category_options}
                                editable={editable}
                            />
                            <LabelsSection
                                workspace={workspace}
                                labels={labels}
                                editable={editable}
                            />
                            <DriveSection
                                workspace={workspace}
                                drive={drive}
                                editable={editable}
                            />
                            {can.archive && (
                                <DangerSection workspace={workspace} />
                            )}
                        </div>
                    </div>
                )}
            </WorkspaceShell>
        </>
    );
}

WorkspaceSettings.layout = (props: Props) =>
    workspaceLayout(props, 'Pengaturan');
