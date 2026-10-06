import { Head, Link } from '@inertiajs/react';
import { History, KeyRound, Mail, Pencil, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import {
    RoleBadges,
    StatusBadge,
    WorkModeBadge,
} from '@/features/employees/employee-badges';
import {
    auditActionLabel,
    auditFieldsLabel,
} from '@/features/employees/labels';
import { PasswordResetRequests } from '@/features/employees/password-reset-requests';
import type { SetPasswordTarget } from '@/features/employees/set-password-dialog';
import { SetPasswordDialog } from '@/features/employees/set-password-dialog';
import type { StatusTarget } from '@/features/employees/status-dialog';
import { StatusDialog } from '@/features/employees/status-dialog';
import type { EmployeeShowProps } from '@/features/employees/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { index, show } from '@/routes/admin/employees';

const STATUS_ACTIONS = [
    'user.deactivated',
    'user.reactivated',
    'user.password_set_by_hr',
    'user.password_changed',
    'user.password_reset_approved',
    'user.password_reset_rejected',
    'user.password_reset_completed',
];

/** Employee profile: personal data, org placement, direct reports, audit (HR). */
export default function EmployeeShow({
    employee,
    directReports,
    audit,
    can,
    passwordReset,
    hasPassword,
}: EmployeeShowProps) {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'mobile';
    const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
    const [passwordTarget, setPasswordTarget] =
        useState<SetPasswordTarget | null>(null);

    return (
        <>
            <Head title={employee.name} />
            <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
                <header className="flex flex-wrap items-center gap-4 md:gap-5">
                    <UserAvatar
                        name={employee.name}
                        src={employee.avatar_url}
                        className="size-14 text-[18px] md:size-[72px] md:text-[24px]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-overline text-link">
                            Organisasi · Karyawan
                        </span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h1 className="text-h1">{employee.name}</h1>
                            <StatusBadge status={employee.status} />
                        </div>
                        <p className="text-body-lg text-text-muted">
                            {[
                                employee.position?.name,
                                employee.division
                                    ? `Divisi ${employee.division.name}`
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(' · ') || 'Belum ditempatkan'}
                        </p>
                    </div>
                    <div className="flex w-full gap-3 md:w-auto">
                        <Button
                            variant="outline"
                            className="flex-1 md:flex-none"
                            asChild
                        >
                            <a href={`mailto:${employee.email}`}>
                                <Mail />
                                Email
                            </a>
                        </Button>
                        {!isMobile && can.deactivate && (
                            <Button
                                variant="outline"
                                className={
                                    employee.status === 'active'
                                        ? 'border-danger/40 text-danger hover:bg-danger-soft hover:text-danger'
                                        : undefined
                                }
                                onClick={() =>
                                    setStatusTarget({
                                        id: employee.id,
                                        name: employee.name,
                                        status: employee.status,
                                        managerName:
                                            employee.manager?.name ?? null,
                                        directReports: directReports.length,
                                    })
                                }
                            >
                                {employee.status === 'active'
                                    ? 'Nonaktifkan'
                                    : 'Aktifkan kembali'}
                            </Button>
                        )}
                        {!isMobile && can.setPassword && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setPasswordTarget({
                                        id: employee.id,
                                        name: employee.name,
                                        email: employee.email,
                                    })
                                }
                                data-test="set-password-button"
                            >
                                <KeyRound />
                                Atur kata sandi
                            </Button>
                        )}
                        {!isMobile && can.update && (
                            <Button asChild>
                                <Link
                                    href={index({
                                        query: { edit: employee.id },
                                    })}
                                >
                                    <Pencil />
                                    Ubah data
                                </Link>
                            </Button>
                        )}
                    </div>
                </header>

                {passwordReset && (
                    <PasswordResetRequests
                        requests={[passwordReset]}
                        showEmployee={false}
                    />
                )}

                <div className="grid items-start gap-5 lg:grid-cols-2">
                    <div className="flex flex-col gap-5">
                        <Card title="Profil">
                            <Row label="Email">
                                <span className="font-mono text-[14px] font-medium break-all">
                                    {employee.email}
                                </span>
                            </Row>
                            <Row label="Nomor karyawan">
                                {employee.employee_number ?? '—'}
                            </Row>
                            <Row label="Telepon">
                                {employee.phone ? (
                                    <a
                                        href={`tel:${employee.phone.replace(/[^\d+]/g, '')}`}
                                        className="text-link hover:underline"
                                    >
                                        {employee.phone}
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </Row>
                            {can.manage && (
                                <Row label="NIK">
                                    <span className="font-mono text-[14px] font-medium">
                                        {employee.nik_masked ?? '—'}
                                    </span>
                                </Row>
                            )}
                            <Row label="Bergabung">
                                {employee.joined_at
                                    ? formatDate(employee.joined_at)
                                    : '—'}
                            </Row>
                            {hasPassword !== null && (
                                <Row label="Kata sandi">
                                    {hasPassword
                                        ? 'Sudah diatur'
                                        : 'Belum diatur'}
                                </Row>
                            )}
                            <Row label="Terakhir masuk">
                                {employee.last_login_at
                                    ? formatRelative(employee.last_login_at)
                                    : 'Belum pernah'}
                            </Row>
                            <Row label="Peran">
                                <RoleBadges roles={employee.roles} />
                            </Row>
                        </Card>

                        <Card title="Penempatan">
                            <Row label="Divisi">
                                {employee.division ? (
                                    <>
                                        {employee.division.name}
                                        {employee.division_head && (
                                            <span className="block text-meta text-text-muted">
                                                Kepala:{' '}
                                                {employee.division_head.name}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    '—'
                                )}
                            </Row>
                            <Row label="Tim">
                                {employee.team ? (
                                    <>
                                        {employee.team.name}
                                        {employee.team_lead && (
                                            <span className="block text-meta text-text-muted">
                                                Ketua: {employee.team_lead.name}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    '—'
                                )}
                            </Row>
                            <Row label="Jabatan">
                                {employee.position?.name ?? '—'}
                            </Row>
                            <Row label="Atasan langsung">
                                {employee.manager ? (
                                    <Link
                                        href={show(employee.manager.id)}
                                        className="flex items-center gap-2 font-semibold text-link hover:underline"
                                    >
                                        <UserAvatar
                                            name={employee.manager.name}
                                            src={employee.manager.avatar_url}
                                            className="size-7"
                                        />
                                        {employee.manager.name}
                                    </Link>
                                ) : (
                                    '—'
                                )}
                            </Row>
                            <Row label="Mode kerja">
                                <WorkModeBadge mode={employee.work_mode} />
                            </Row>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-5">
                        <Card
                            title={`Bawahan langsung (${directReports.length})`}
                        >
                            {directReports.length === 0 ? (
                                <EmptyState
                                    icon={Users}
                                    title="Tidak ada bawahan langsung"
                                    className="border-0 bg-transparent py-6"
                                />
                            ) : (
                                <ul className="-mx-5 divide-y divide-divider border-t border-divider md:-mx-6">
                                    {directReports.map((report) => (
                                        <li key={report.id}>
                                            <Link
                                                href={show(report.id)}
                                                className={cn(
                                                    'flex min-h-16 items-center gap-3 px-5 py-2 transition-colors duration-120 ease-brand hover:bg-background md:px-6',
                                                    focusRing,
                                                    'focus-visible:ring-inset',
                                                )}
                                            >
                                                <UserAvatar
                                                    name={report.name}
                                                    src={report.avatar_url}
                                                    className="size-10"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[16px] font-semibold text-text">
                                                        {report.name}
                                                    </span>
                                                    <span className="block truncate text-meta text-text-muted">
                                                        {report.position ?? '—'}
                                                    </span>
                                                </span>
                                                <StatusBadge
                                                    status={report.status}
                                                    className="h-[26px] gap-1.5 px-2.5 text-[13px]"
                                                />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>

                        {audit !== null && (
                            <Card title="Riwayat perubahan">
                                {audit.length === 0 ? (
                                    <EmptyState
                                        icon={History}
                                        title="Belum ada perubahan tercatat"
                                        className="border-0 bg-transparent py-6"
                                    />
                                ) : (
                                    <ol className="flex flex-col gap-4">
                                        {audit.map((entry) => (
                                            <li
                                                key={entry.id}
                                                className="border-l-[3px] border-link-soft pl-4"
                                            >
                                                <p className="text-[15px] font-semibold text-text">
                                                    {auditActionLabel(
                                                        entry.action,
                                                    )}
                                                    {entry.fields.length > 0 &&
                                                        !STATUS_ACTIONS.includes(
                                                            entry.action,
                                                        ) && (
                                                            <span className="text-text-muted">
                                                                {' · '}
                                                                {auditFieldsLabel(
                                                                    entry.fields,
                                                                )}
                                                            </span>
                                                        )}
                                                </p>
                                                {entry.reason && (
                                                    <p className="text-[15px] text-text-muted">
                                                        “{entry.reason}”
                                                    </p>
                                                )}
                                                <p className="text-meta text-text-subtle">
                                                    {entry.actor ?? 'Sistem'}
                                                    {' · '}
                                                    <time
                                                        dateTime={
                                                            entry.created_at
                                                        }
                                                        title={formatDateTime(
                                                            entry.created_at,
                                                        )}
                                                    >
                                                        {formatRelative(
                                                            entry.created_at,
                                                        )}
                                                    </time>
                                                </p>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </Card>
                        )}
                    </div>
                </div>

                {isMobile && can.update && (
                    <p className="text-center text-meta text-text-muted">
                        Ubah data, divisi, peran, atau kata sandi lewat desktop.
                    </p>
                )}
            </div>

            <StatusDialog
                target={statusTarget}
                onClose={() => setStatusTarget(null)}
            />
            <SetPasswordDialog
                target={passwordTarget}
                onClose={() => setPasswordTarget(null)}
            />
        </>
    );
}

EmployeeShow.layout = {
    breadcrumbs: [
        { title: 'Organisasi', href: '' },
        { title: 'Karyawan', href: index() },
        { title: 'Profil', href: '' },
    ],
    title: 'Profil karyawan',
    back: '/admin/karyawan',
};

function Card({ title, children }: { title: string; children: ReactNode }) {
    return (
        <Panel title={title} className="pb-2">
            {children}
        </Panel>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid min-h-13 grid-cols-[minmax(110px,140px)_1fr] items-center gap-3 border-t border-divider py-2.5 text-[16px]">
            <span className="text-[15px] text-text-muted">{label}</span>
            <span className="min-w-0 text-text">{children}</span>
        </div>
    );
}
