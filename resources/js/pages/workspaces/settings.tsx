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
import type { ProjectSettings } from '@/features/workspaces/settings/project-section';
import { ProjectSection } from '@/features/workspaces/settings/project-section';
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
    project_settings: ProjectSettings | null;
};

const NAV = [
    ['umum', 'Umum'],
    ['proyek', 'Proyek'],
    ['anggota', 'Anggota'],
    ['kolom-status', 'Kolom status'],
    ['label', 'Label'],
    ['integrasi-drive', 'Integrasi Drive'],
] as const;

/** Mobile: members are readable, the rest is desktop only (docs/PLATFORM.md §3 ◐). */
function MobileSettings({ members }: { members: MemberDetail[] }) {
    const { auth } = usePage().props;

    return (
        <div className="flex flex-col gap-4">
            <DesktopOnlyNotice feature="Pengaturan nama, key, kolom status, label, dan anggota" />
            <p className="text-body text-text-muted">
                Daftar anggota bisa dilihat di sini.
            </p>
            <section className="flex flex-col gap-2.5">
                <h2 className="text-h3">Anggota · {members.length}</h2>
                <ul className="divide-y divide-divider overflow-hidden rounded-card border border-border bg-surface">
                    {members.map((member) => (
                        <li
                            key={member.id}
                            className="flex min-h-[72px] items-center gap-3.5 px-4 py-2"
                        >
                            <UserAvatar
                                name={member.name}
                                src={member.avatar}
                                className="size-11 text-[15px]"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[17px] font-semibold text-text">
                                    {member.name}
                                    {member.id === auth.user?.id && (
                                        <span className="text-text-muted">
                                            {' '}
                                            (Anda)
                                        </span>
                                    )}
                                </span>
                                <span className="block truncate text-label font-normal text-text-muted">
                                    {member.division ?? member.position ?? '–'}
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-meta font-semibold text-text-muted">
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
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,860px)]">
                        <nav
                            aria-label="Bagian pengaturan"
                            className="hidden lg:block"
                        >
                            <ul className="sticky top-24 flex flex-col gap-1">
                                {NAV.filter(
                                    ([id]) =>
                                        (id !== 'anggota' ||
                                            workspace.type !== 'personal') &&
                                        (id !== 'proyek' ||
                                            props.project_settings !== null),
                                ).map(([id, label]) => (
                                    <li key={id}>
                                        <a
                                            href={`#${id}`}
                                            className="flex h-11 items-center justify-between rounded-control px-3.5 text-[16px] font-medium text-text-muted transition-colors duration-120 ease-brand hover:bg-surface hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                                        >
                                            {label}
                                            {id === 'anggota' && (
                                                <span className="text-[14px] tnum">
                                                    {member_details.length}
                                                </span>
                                            )}
                                            {id === 'integrasi-drive' &&
                                                drive.access.state ===
                                                    'synced' && (
                                                    <span
                                                        aria-label="Tersinkron"
                                                        className="size-2 rounded-full bg-success"
                                                    />
                                                )}
                                        </a>
                                    </li>
                                ))}
                                {can.archive && (
                                    <li className="mt-2 border-t border-border pt-3">
                                        <a
                                            href="#zona-bahaya"
                                            className="flex h-11 items-center rounded-control px-3.5 text-[16px] font-medium text-danger hover:bg-danger-soft focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                                        >
                                            Zona bahaya
                                        </a>
                                    </li>
                                )}
                            </ul>
                        </nav>
                        <div className="flex min-w-0 flex-col gap-5">
                            {myRole && (
                                <p className="text-right text-label font-normal text-text-muted">
                                    Anda:{' '}
                                    <span className="font-bold text-text">
                                        {ROLE_LABELS[myRole]}
                                    </span>
                                </p>
                            )}
                            <GeneralSection
                                workspace={workspace}
                                editable={editable}
                            />
                            {props.project_settings && (
                                <ProjectSection
                                    workspace={workspace}
                                    settings={props.project_settings}
                                    members={member_details}
                                    editable={editable}
                                />
                            )}
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
