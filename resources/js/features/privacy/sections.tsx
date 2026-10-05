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
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge as AttendanceBadge } from '@/features/attendance/status-badge';
import {
    StatusBadge as RequestBadge,
    TonePill,
} from '@/features/requests/badges';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { Tone } from '@/lib/requests';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
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

/** A titled card; `flush` lets lists run edge to edge. */
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
    const id = useId();

    return (
        <section
            aria-labelledby={id}
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 pt-4 pb-3">
                <div className="min-w-0">
                    <h2 id={id} className="text-[15px] font-semibold text-text">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-0.5 text-[13px] text-text-muted">
                            {description}
                        </p>
                    )}
                </div>
                {aside && (
                    <div className="text-[13px] text-text-muted">{aside}</div>
                )}
            </header>
            <div className={flush ? 'pb-1' : 'px-4 pb-4'}>{children}</div>
        </section>
    );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-2 px-4 pb-3" aria-busy>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-11 rounded-md" />
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {links.map(({ format, label, hint, icon: Icon }) => (
                    <a
                        key={format}
                        href={exportMethod.url(format)}
                        className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    >
                        <Icon
                            className="size-5 shrink-0 text-primary"
                            aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-text">
                                {label}
                            </span>
                            <span className="block text-xs text-text-muted">
                                {hint}
                            </span>
                        </span>
                        <Download
                            className="size-4 text-text-subtle"
                            aria-hidden
                        />
                    </a>
                ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">
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
              tone: 'text-success bg-success/10',
              title: 'Diberikan',
              text: `Untuk kebijakan versi ${consent.granted_version ?? consent.version}${consent.granted_at ? `, sejak ${formatDate(consent.granted_at)}` : ''}.`,
          }
        : {
              icon: ShieldOff,
              tone: 'text-warning bg-warning/10',
              title: consent.needs_renewal
                  ? 'Perlu persetujuan ulang'
                  : 'Belum diberikan / dicabut',
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
            <div className="flex items-start gap-3 rounded-lg bg-surface-2 p-3">
                <span
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        status.tone,
                    )}
                >
                    <StatusIcon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 text-sm">
                    <p className="font-medium text-text">{status.title}</p>
                    <p className="mt-0.5 text-[13px] text-text-muted">
                        {status.text}
                    </p>
                </div>
            </div>
            <p className="mt-3 text-[13px] text-text-muted">
                Selfie dihapus otomatis setelah {consent.retention_months}{' '}
                bulan.{' '}
                <Link
                    href={policyRoute()}
                    className="font-medium text-primary hover:underline"
                >
                    Baca kebijakan privasi v{consent.policy_version}
                </Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                {consent.granted ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 text-danger hover:text-danger md:h-9"
                        onClick={() => setDialog('revoke')}
                    >
                        Cabut persetujuan
                    </Button>
                ) : (
                    <Button
                        type="button"
                        className="h-11 md:h-9"
                        onClick={() => setDialog('grant')}
                    >
                        Berikan persetujuan
                    </Button>
                )}
            </div>

            {consent.history.length > 0 && (
                <Collapsible className="mt-3 border-t border-border pt-2">
                    <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between rounded-md text-left text-[13px] font-medium text-text-muted hover:text-text md:min-h-9">
                        Riwayat persetujuan ({consent.history.length})
                        <ChevronDown
                            className="size-4 transition-transform group-data-[state=open]:rotate-180"
                            aria-hidden
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="divide-y divide-border text-[13px]">
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
        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 py-2 text-sm">
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
            <dl className="divide-y divide-border">
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
                <Link
                    href="/absensi/riwayat"
                    className="font-medium text-primary hover:underline"
                >
                    Riwayat per bulan →
                </Link>
            }
            flush
        >
            {attendance === undefined ? (
                <ListSkeleton rows={5} />
            ) : attendance.total_days === 0 ? (
                <div className="px-4 pb-3">
                    <EmptyState
                        icon={CalendarCheck}
                        title="Belum ada data absensi"
                        description="Data muncul di sini setelah check-in pertama Anda."
                    />
                </div>
            ) : (
                <>
                    <ul
                        className="flex flex-wrap gap-1.5 px-4 pb-3"
                        aria-label="Jumlah hari per status"
                    >
                        {Object.entries(attendance.counts).map(
                            ([status, count]) => (
                                <li
                                    key={status}
                                    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs text-text-muted"
                                >
                                    {statusLabels[status] ?? status}
                                    <span className="font-semibold text-text tnum">
                                        {formatNumber(count ?? 0)}
                                    </span>
                                </li>
                            ),
                        )}
                    </ul>

                    {/* Desktop/tablet: table. */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <caption className="sr-only">
                                {attendance.days.length} hari absensi terakhir
                            </caption>
                            <thead>
                                <tr className="border-y border-border bg-surface-2 text-left text-xs text-text-muted">
                                    <th
                                        scope="col"
                                        className="px-4 py-2 font-medium"
                                    >
                                        Tanggal
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        Status
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        Masuk
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        Pulang
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        Metode · lokasi
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-2 text-right font-medium"
                                    >
                                        Kerja
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {attendance.days.map((day) => (
                                    <tr key={day.date}>
                                        <td className="px-4 py-2 whitespace-nowrap text-text">
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
                                        <td className="px-3 py-2 text-text-muted">
                                            {[day.method, day.location]
                                                .filter(Boolean)
                                                .join(' · ') || '–'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-text-muted tnum">
                                            {minutesLabel(day.work_minutes) ??
                                                '–'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: list rows. */}
                    <ul className="divide-y divide-border border-t border-border md:hidden">
                        {attendance.days.map((day) => (
                            <li
                                key={day.date}
                                className="flex min-h-14 items-center gap-3 px-4 py-2"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] text-text">
                                        {formatDate(day.date)}
                                    </span>
                                    <span className="block text-[13px] text-text-muted">
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
                    <p className="px-4 pt-2 pb-2 text-xs text-text-muted">
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
            className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
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
            aside={
                <Link
                    href="/pengajuan"
                    className="font-medium text-primary hover:underline"
                >
                    Semua pengajuan →
                </Link>
            }
            flush
        >
            {requests === undefined ? (
                <ListSkeleton />
            ) : requests.items.length === 0 ? (
                <div className="px-4 pb-3">
                    <EmptyState
                        icon={Inbox}
                        title="Belum ada pengajuan"
                        description="Pengajuan cuti, izin, atau lembur Anda akan tercatat di sini."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {requests.items.map((item) => (
                        <li key={item.id}>
                            <RowLink href={item.url}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-text">
                                        {item.number && (
                                            <span className="mr-1.5 font-mono text-[13px] text-text-muted">
                                                {item.number}
                                            </span>
                                        )}
                                        {item.type}
                                    </span>
                                    <span className="block truncate text-[13px] text-text-muted">
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
                <div className="px-4 pb-3">
                    <EmptyState
                        icon={CheckCheck}
                        title="Belum ada keputusan"
                        description="Keputusan Anda atas pengajuan rekan kerja akan tercatat di sini."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {decisions.items.map((item) => (
                        <li key={item.id}>
                            <RowLink href={item.url}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-text">
                                        {item.requester} · {item.type}
                                    </span>
                                    <span className="block truncate text-[13px] text-text-muted">
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
