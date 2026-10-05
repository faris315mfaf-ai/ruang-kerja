import { Link, router } from '@inertiajs/react';
import {
    CalendarCheck,
    CheckCheck,
    ChevronDown,
    Download,
    FileSpreadsheet,
    FileText,
    Inbox,
    ShieldCheck,
    ShieldOff,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge as AttendanceBadge } from '@/features/attendance/status-badge';
import {
    StatusBadge as RequestBadge,
    TonePill,
} from '@/features/requests/badges';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { Tone } from '@/lib/requests';
import { roleLabel } from '@/lib/roles';
import { cn, focusRing } from '@/lib/utils';
import consentRoutes from '@/routes/attendance/consent';
import { exportMethod, policy as policyRoute } from '@/routes/privacy';
import type {
    Listing,
    MyAttendance,
    MyConsent,
    MyDecisionItem,
    MyProfile,
    MyRequestItem,
} from './types';

/**
 * A titled Arus panel (SPengaturan cards); `flush` lets lists run edge to
 * edge. The description sits under the title, `aside` on the right.
 */
export function PrivacySection({
    title,
    description,
    aside,
    children,
    flush = false,
}: {
    title: string;
    description?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
    flush?: boolean;
}) {
    return (
        <Panel
            title={title}
            action={aside}
            flush={flush}
            className={flush ? 'pb-2' : undefined}
        >
            {description && (
                <p
                    className={cn(
                        '-mt-1 mb-4 text-label font-normal text-text-muted',
                        flush && 'px-6 md:px-7',
                    )}
                >
                    {description}
                </p>
            )}
            {children}
        </Panel>
    );
}

/** "Riwayat per bulan", "Semua pengajuan": teal link on the panel header. */
function AsideLink({ href, children }: { href: string; children: ReactNode }) {
    return <PanelLink href={href}>{children}</PanelLink>;
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-2 px-6 pb-3 md:px-7" aria-busy>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-12 rounded-control" />
            ))}
        </div>
    );
}

/** "Unduh data saya" — Excel or PDF of everything (not only what is listed). */
export function ExportCard() {
    const links = [
        {
            format: 'xlsx',
            label: 'Unduh Excel',
            hint: 'Satu sheet per jenis data',
            icon: FileSpreadsheet,
        },
        {
            format: 'pdf',
            label: 'Unduh PDF',
            hint: 'Siap dicetak',
            icon: FileText,
        },
    ] as const;

    return (
        <PrivacySection
            title="Unduh data saya"
            description="Profil, persetujuan, seluruh absensi & log, pengajuan, dan keputusan persetujuan Anda."
        >
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                {links.map(({ format, label, hint, icon: Icon }) => (
                    <a
                        key={format}
                        href={exportMethod.url(format)}
                        className={cn(
                            'flex min-h-[60px] items-center gap-3 rounded-lg border border-border px-4 py-2 text-left transition-colors duration-120 ease-brand hover:bg-background',
                            focusRing,
                        )}
                    >
                        <Icon
                            className="size-5 shrink-0 text-primary"
                            aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block text-body font-semibold text-text">
                                {label}
                            </span>
                            <span className="block text-meta text-text-muted">
                                {hint}
                            </span>
                        </span>
                        <Download
                            className="size-5 text-text-subtle"
                            aria-hidden
                        />
                    </a>
                ))}
            </div>
            <p className="mt-3 text-meta text-text-muted">
                NIK ditampilkan tersamar dan foto selfie tidak disertakan.
                Setiap unduhan tercatat di log audit.
            </p>
        </PrivacySection>
    );
}

/** Consent for location + selfie: status, version, history, withdraw / give. */
export function ConsentCard({ consent }: { consent: MyConsent }) {
    const [dialog, setDialog] = useState<'revoke' | 'grant' | null>(null);
    const [processing, setProcessing] = useState(false);

    const submit = () => {
        const options = {
            preserveScroll: true,
            only: ['consent'],
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                setDialog(null);
            },
        };

        if (dialog === 'revoke') {
            router.delete(consentRoutes.destroy.url(), options);
        } else {
            router.post(consentRoutes.store.url(), {}, options);
        }
    };

    const status = consent.granted
        ? {
              icon: ShieldCheck,
              box: 'bg-success-soft',
              tone: 'text-success',
              title: 'Lokasi & selfie: disetujui',
              text: `Untuk kebijakan versi ${consent.granted_version ?? consent.version}${consent.granted_at ? `, sejak ${formatDate(consent.granted_at)}` : ''}.`,
          }
        : {
              icon: ShieldOff,
              box: 'bg-warning-soft',
              tone: 'text-warning',
              title: consent.needs_renewal
                  ? 'Lokasi & selfie: perlu persetujuan ulang'
                  : 'Lokasi & selfie: belum disetujui',
              text: consent.needs_renewal
                  ? `Kebijakan berubah ke versi ${consent.version}. Check-in GPS + selfie tidak bisa dilakukan sampai Anda menyetujui versi ini.`
                  : 'Check-in GPS + selfie tidak bisa dilakukan. Kiosk QR dan koreksi oleh HR tetap tersedia.',
          };
    const StatusIcon = status.icon;

    return (
        <PrivacySection
            title="Persetujuan lokasi & selfie"
            description="Dasar pemrosesan lokasi GPS dan foto selfie saat check-in/check-out (UU PDP)."
        >
            <div
                className={cn(
                    'flex items-start gap-3 rounded-lg px-4 py-3.5',
                    status.box,
                )}
            >
                <StatusIcon
                    className={cn('mt-0.5 size-5 shrink-0', status.tone)}
                    aria-hidden
                />
                <div className="flex min-w-0 flex-col gap-1">
                    <p className={cn('text-body font-bold', status.tone)}>
                        {status.title}
                    </p>
                    <p className="text-label font-normal text-text">
                        {status.text}
                    </p>
                </div>
            </div>
            <p className="mt-4 text-label font-normal text-text-muted">
                Selfie dihapus otomatis setelah {consent.retention_months}{' '}
                bulan.{' '}
                <Link
                    href={policyRoute()}
                    className="font-semibold text-link hover:opacity-80"
                >
                    Baca kebijakan privasi v{consent.policy_version}
                </Link>
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
                {consent.granted ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="text-danger"
                        onClick={() => setDialog('revoke')}
                    >
                        Cabut persetujuan
                    </Button>
                ) : (
                    <Button type="button" onClick={() => setDialog('grant')}>
                        Berikan persetujuan
                    </Button>
                )}
            </div>

            {consent.history.length > 0 && (
                <Collapsible className="mt-4 border-t border-divider pt-2">
                    <CollapsibleTrigger
                        className={cn(
                            'group flex min-h-control w-full items-center justify-between rounded-control text-left text-label text-text-muted hover:text-text',
                            focusRing,
                        )}
                    >
                        Riwayat persetujuan ({consent.history.length})
                        <ChevronDown
                            className="size-5 transition-transform duration-180 ease-brand group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                            aria-hidden
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="divide-y divide-divider text-label font-normal">
                            {consent.history.map((record) => (
                                <li
                                    key={record.id}
                                    className="flex flex-wrap items-baseline justify-between gap-x-3 py-2"
                                >
                                    <span className="text-text">
                                        {record.type_label} · v{record.version}
                                    </span>
                                    <span className="text-text-muted tnum">
                                        {formatDate(record.granted_at)}
                                        {record.revoked_at
                                            ? ` → dicabut ${formatDate(record.revoked_at)}`
                                            : ' · aktif'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            )}

            <Dialog
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {dialog === 'revoke'
                                ? 'Cabut persetujuan?'
                                : `Setujui kebijakan versi ${consent.version}?`}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog === 'revoke'
                                ? 'Check-in dan check-out dengan GPS + selfie dinonaktifkan sampai Anda menyetujui lagi. HR akan diberi tahu untuk mengatur cara absensi lain. Data yang sudah tercatat tetap disimpan sesuai kebijakan.'
                                : 'Lokasi GPS dan foto selfie diproses hanya saat Anda check-in atau check-out, untuk mencatat kehadiran. Anda dapat mencabutnya kapan saja.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDialog(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant={
                                dialog === 'revoke' ? 'destructive' : 'default'
                            }
                            disabled={processing}
                            onClick={submit}
                        >
                            {dialog === 'revoke'
                                ? 'Cabut persetujuan'
                                : 'Setujui'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PrivacySection>
    );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 py-2.5 text-label font-normal">
            <dt className="text-text-muted">{label}</dt>
            <dd className="break-words text-text">
                {value === null || value === '' ? (
                    <span className="text-text-subtle">–</span>
                ) : (
                    value
                )}
            </dd>
        </div>
    );
}

/** Profile data held about the user (NIK masked). */
export function ProfileCard({ profile }: { profile: MyProfile }) {
    return (
        <PrivacySection
            title="Data profil"
            description="Data kepegawaian yang tersimpan. Hubungi HR bila ada yang keliru."
        >
            <dl className="divide-y divide-divider">
                <Field label="Nama" value={profile.name} />
                <Field label="Email" value={profile.email} />
                <Field label="No. karyawan" value={profile.employee_number} />
                <Field
                    label="NIK"
                    value={
                        profile.nik_masked && (
                            <span className="font-mono tnum">
                                {profile.nik_masked}
                            </span>
                        )
                    }
                />
                <Field label="Telepon" value={profile.phone} />
                <Field
                    label="Tanggal lahir"
                    value={profile.birth_date && formatDate(profile.birth_date)}
                />
                <Field label="Alamat" value={profile.address} />
                <Field
                    label="Kontak darurat"
                    value={profile.emergency_contact}
                />
                <Field label="Divisi" value={profile.division} />
                <Field label="Tim" value={profile.team} />
                <Field label="Jabatan" value={profile.position} />
                <Field label="Atasan" value={profile.manager} />
                <Field label="Mode kerja" value={profile.work_mode} />
                <Field
                    label="Bergabung"
                    value={profile.joined_at && formatDate(profile.joined_at)}
                />
                <Field
                    label="Peran akses"
                    value={profile.roles.map(roleLabel).join(', ')}
                />
                <Field
                    label="Akun Google"
                    value={profile.google_linked ? 'Tertaut' : 'Belum tertaut'}
                />
                <Field
                    label="Login terakhir"
                    value={
                        profile.last_login_at &&
                        formatDateTime(profile.last_login_at)
                    }
                />
            </dl>
        </PrivacySection>
    );
}

function minutesLabel(minutes: number): string | null {
    if (minutes <= 0) {
        return null;
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return hours > 0 ? `${hours} j ${rest} m` : `${rest} m`;
}

/** Attendance totals + the latest days. */
export function AttendanceCard({
    attendance,
    statusLabels,
}: {
    attendance: MyAttendance | undefined;
    statusLabels: Record<string, string>;
}) {
    return (
        <PrivacySection
            title="Data absensi"
            description={
                attendance && attendance.first_date
                    ? `${formatNumber(attendance.total_days)} hari tercatat sejak ${formatDate(attendance.first_date)} · ${formatNumber(attendance.logs)} log check-in/out · ${formatNumber(attendance.selfies)} selfie tersimpan`
                    : 'Kehadiran harian, log check-in/out, dan selfie yang masih tersimpan.'
            }
            aside={
                <AsideLink href="/absensi/riwayat">Riwayat per bulan</AsideLink>
            }
            flush
        >
            {attendance === undefined ? (
                <ListSkeleton rows={5} />
            ) : attendance.total_days === 0 ? (
                <div className="px-6 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={CalendarCheck}
                        title="Belum ada data absensi"
                        description="Data muncul di sini setelah check-in pertama Anda."
                    />
                </div>
            ) : (
                <>
                    <ul
                        className="flex flex-wrap gap-2 px-6 pb-4 md:px-7"
                        aria-label="Jumlah hari per status"
                    >
                        {Object.entries(attendance.counts).map(
                            ([status, count]) => (
                                <li key={status}>
                                    <Badge variant="label" tone="neutral">
                                        {statusLabels[status] ?? status}
                                        <span className="tnum">
                                            {formatNumber(count ?? 0)}
                                        </span>
                                    </Badge>
                                </li>
                            ),
                        )}
                    </ul>

                    {/* Wide screens: table. */}
                    <div className="hidden overflow-x-auto 2xl:block">
                        <table className="w-full text-body">
                            <caption className="sr-only">
                                {attendance.days.length} hari absensi terakhir
                            </caption>
                            <thead>
                                <tr className="bg-background text-left text-meta font-bold text-text-muted">
                                    <th
                                        scope="col"
                                        className="py-2.5 pr-3 pl-6 md:pl-7"
                                    >
                                        Tanggal
                                    </th>
                                    <th scope="col" className="px-3 py-2.5">
                                        Status
                                    </th>
                                    <th scope="col" className="px-3 py-2.5">
                                        Masuk
                                    </th>
                                    <th scope="col" className="px-3 py-2.5">
                                        Pulang
                                    </th>
                                    <th scope="col" className="px-3 py-2.5">
                                        Metode · lokasi
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2.5 pr-6 pl-3 text-right md:pr-7"
                                    >
                                        Kerja
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-divider">
                                {attendance.days.map((day) => (
                                    <tr key={day.date}>
                                        <td className="h-14 py-2 pr-3 pl-6 whitespace-nowrap text-text md:pl-7">
                                            {formatDate(day.date)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <AttendanceBadge
                                                status={day.status}
                                                minutes={day.late_minutes}
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-text tnum">
                                            {day.check_in ?? '–'}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-text tnum">
                                            {day.check_out ?? '–'}
                                        </td>
                                        <td className="max-w-56 truncate px-3 py-2 text-text-muted">
                                            {[day.method, day.location]
                                                .filter(Boolean)
                                                .join(' · ') || '–'}
                                        </td>
                                        <td className="py-2 pr-6 pl-3 text-right text-text-muted tnum md:pr-7">
                                            {minutesLabel(day.work_minutes) ??
                                                '–'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Phones, tablets and narrow desktop columns: list rows. */}
                    <ul className="divide-y divide-divider border-t border-divider 2xl:hidden">
                        {attendance.days.map((day) => (
                            <li
                                key={day.date}
                                className="flex min-h-[60px] items-center gap-3 px-6 py-2 md:px-7"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-body font-semibold text-text">
                                        {formatDate(day.date)}
                                    </span>
                                    <span className="block text-label font-normal text-text-muted">
                                        <span className="font-mono tnum">
                                            {day.check_in ?? '–'} –{' '}
                                            {day.check_out ?? '–'}
                                        </span>
                                        {day.method ? ` · ${day.method}` : ''}
                                    </span>
                                </span>
                                <AttendanceBadge
                                    status={day.status}
                                    minutes={day.late_minutes}
                                    compact
                                />
                            </li>
                        ))}
                    </ul>
                    <p className="px-6 pt-3 pb-2 text-meta text-text-muted md:px-7">
                        Menampilkan {attendance.days.length} hari terakhir.
                        Unduhan berisi seluruh data, termasuk koordinat GPS dan
                        data teknis tiap log.
                    </p>
                </>
            )}
        </PrivacySection>
    );
}

const DECISION_TONE: Record<MyDecisionItem['decision'], Tone> = {
    approved: 'success',
    rejected: 'danger',
    revision_requested: 'info',
};

function RowLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className={cn(
                'flex min-h-[60px] items-center gap-3 px-6 py-2 transition-colors duration-120 ease-brand hover:bg-background md:px-7',
                focusRing,
                'focus-visible:ring-inset',
            )}
        >
            {children}
        </Link>
    );
}

/** Requests the user submitted. */
export function RequestsCard({
    requests,
}: {
    requests: Listing<MyRequestItem> | undefined;
}) {
    return (
        <PrivacySection
            title="Pengajuan saya"
            description={
                requests
                    ? `${formatNumber(requests.count)} pengajuan`
                    : 'Cuti, izin, sakit, lembur, koreksi, dan dinas yang Anda ajukan.'
            }
            aside={<AsideLink href="/pengajuan">Semua pengajuan</AsideLink>}
            flush
        >
            {requests === undefined ? (
                <ListSkeleton />
            ) : requests.items.length === 0 ? (
                <div className="px-6 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={Inbox}
                        title="Belum ada pengajuan"
                        description="Pengajuan cuti, izin, atau lembur Anda akan tercatat di sini."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-divider border-t border-divider">
                    {requests.items.map((item) => (
                        <li key={item.id}>
                            <RowLink href={item.url}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-body font-semibold text-text">
                                        {item.number && (
                                            <span className="mr-1.5 font-mono text-label text-text-muted">
                                                {item.number}
                                            </span>
                                        )}
                                        {item.type}
                                    </span>
                                    <span className="block truncate text-label font-normal text-text-muted">
                                        {item.summary}
                                    </span>
                                </span>
                                <RequestBadge
                                    status={item.status}
                                    label={item.status_label}
                                />
                            </RowLink>
                        </li>
                    ))}
                </ul>
            )}
        </PrivacySection>
    );
}

/** Approval decisions the user made. */
export function DecisionsCard({
    decisions,
}: {
    decisions: Listing<MyDecisionItem> | undefined;
}) {
    return (
        <PrivacySection
            title="Keputusan persetujuan saya"
            description={
                decisions
                    ? `${formatNumber(decisions.count)} keputusan sebagai penyetuju`
                    : 'Pengajuan yang Anda setujui, tolak, atau minta revisi.'
            }
            flush
        >
            {decisions === undefined ? (
                <ListSkeleton />
            ) : decisions.items.length === 0 ? (
                <div className="px-6 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={CheckCheck}
                        title="Belum ada keputusan"
                        description="Keputusan Anda atas pengajuan rekan kerja akan tercatat di sini."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-divider border-t border-divider">
                    {decisions.items.map((item) => (
                        <li key={item.id}>
                            <RowLink href={item.url}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-body font-semibold text-text">
                                        {item.requester} · {item.type}
                                    </span>
                                    <span className="block truncate text-label font-normal text-text-muted">
                                        {item.number && (
                                            <span className="mr-1.5 font-mono">
                                                {item.number}
                                            </span>
                                        )}
                                        {item.decided_at
                                            ? formatDateTime(item.decided_at)
                                            : item.summary}
                                    </span>
                                </span>
                                <TonePill tone={DECISION_TONE[item.decision]}>
                                    {item.decision_label}
                                </TonePill>
                            </RowLink>
                        </li>
                    ))}
                </ul>
            )}
        </PrivacySection>
    );
}
