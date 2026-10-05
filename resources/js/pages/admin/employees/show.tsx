import { Head, Link } from '@inertiajs/react';
import { History, Mail, Pencil, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    RoleBadges,
    StatusBadge,
    WorkModeBadge,
} from '@/features/employees/employee-badges';
import {
    auditActionLabel,
    auditFieldsLabel,
} from '@/features/employees/labels';
import type { StatusTarget } from '@/features/employees/status-dialog';
import { StatusDialog } from '@/features/employees/status-dialog';
import type { EmployeeShowProps } from '@/features/employees/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { index, show } from '@/routes/admin/employees';

const STATUS_ACTIONS = ['user.deactivated', 'user.reactivated'];

/** Employee profile: personal data, org placement, direct reports, audit (HR). */
export default function EmployeeShow({
    employee,
    directReports,
    audit,
    can,
}: EmployeeShowProps) {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'mobile';
    const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);

    return (
        <>
            <Head title={employee.name} />
            <div className="mx-auto max-w-5xl space-y-5">
                <header className="flex flex-wrap items-center gap-4">
                    <UserAvatar
                        name={employee.name}
                        src={employee.avatar_url}
                        className="size-14 text-base"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h1 className="text-xl leading-7 font-semibold text-text">
                                {employee.name}
                            </h1>
                            <StatusBadge status={employee.status} />
                        </div>
                        <p className="text-[13px] text-text-muted">
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
                    <div className="flex w-full gap-2 md:w-auto">
                        <Button
                            variant="outline"
                            className="h-11 flex-1 md:h-9 md:flex-none"
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

                <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-5">
                        <Card title="Profil">
                            <Row label="Email">
                                <span className="font-mono text-[13px] break-all">
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
                                        className="hover:underline"
                                    >
                                        {employee.phone}
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </Row>
                            {can.manage && (
                                <Row label="NIK">
                                    <span className="font-mono text-[13px]">
                                        {employee.nik_masked ?? '—'}
                                    </span>
                                </Row>
                            )}
                            <Row label="Bergabung">
                                {employee.joined_at
                                    ? formatDate(employee.joined_at)
                                    : '—'}
                            </Row>
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
                                            <span className="block text-xs text-text-muted">
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
                                            <span className="block text-xs text-text-muted">
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
                                        className="flex items-center gap-2 hover:underline"
                                    >
                                        <UserAvatar
                                            name={employee.manager.name}
                                            src={employee.manager.avatar_url}
                                            className="size-6"
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

                    <div className="space-y-5">
                        <Card
                            title={`Bawahan langsung (${directReports.length})`}
                        >
                            {directReports.length === 0 ? (
                                <EmptyState
                                    icon={Users}
                                    title="Tidak ada bawahan langsung"
                                    className="border-0 py-8"
                                />
                            ) : (
                                <ul className="divide-y divide-border">
                                    {directReports.map((report) => (
                                        <li key={report.id}>
                                            <Link
                                                href={show(report.id)}
                                                className="flex min-h-12 items-center gap-3 py-2 hover:bg-surface-2/60"
                                            >
                                                <UserAvatar
                                                    name={report.name}
                                                    src={report.avatar_url}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-text">
                                                        {report.name}
                                                    </span>
                                                    <span className="block truncate text-xs text-text-muted">
                                                        {report.position ?? '—'}
                                                    </span>
                                                </span>
                                                <StatusBadge
                                                    status={report.status}
                                                    className="text-xs"
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
                                        className="border-0 py-8"
                                    />
                                ) : (
                                    <ol className="space-y-3">
                                        {audit.map((entry) => (
                                            <li
                                                key={entry.id}
                                                className="border-l-2 border-border pl-3"
                                            >
                                                <p className="text-sm text-text">
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
                                                    <p className="text-[13px] text-text-muted">
                                                        “{entry.reason}”
                                                    </p>
                                                )}
                                                <p className="text-xs text-text-subtle">
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
                    <p className="text-center text-xs text-text-muted">
                        Ubah data, divisi, atau peran lewat desktop.
                    </p>
                )}
            </div>

            <StatusDialog
                target={statusTarget}
                onClose={() => setStatusTarget(null)}
            />
        </>
    );
}

EmployeeShow.layout = {
    breadcrumbs: [
        { title: 'Admin', href: index() },
        { title: 'Karyawan', href: index() },
        { title: 'Profil', href: index() },
    ],
    title: 'Profil karyawan',
    back: '/admin/karyawan',
};

function Card({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <h2 className="mb-2 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                {title}
            </h2>
            {children}
        </section>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid min-h-11 grid-cols-[130px_1fr] items-center gap-3 border-b border-border py-2 text-sm last:border-b-0">
            <span className="text-text-muted">{label}</span>
            <span className="min-w-0 text-text">{children}</span>
        </div>
    );
}
