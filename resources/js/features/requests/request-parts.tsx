import { AlertTriangle, FileText, Paperclip } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    colleagueSummary,
    formatDays,
    formatLongDateRange,
    formatRequestDuration,
    formatRequestPeriod,
} from '@/lib/requests';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    BalanceSummary,
    ColleagueAbsence,
    PlannedStep,
    RequestDetail,
} from '@/types/requests';

function hhmm(value: string | null | undefined): string {
    return value ? value.slice(0, 5).replace(':', '.') : '–';
}

/** Label/value rows of a request (detail panel, mobile detail card). */
export function RequestFields({
    request,
    className,
}: {
    request: RequestDetail;
    className?: string;
}) {
    const category = request.type.category;
    const rows: { label: string; value: React.ReactNode }[] = [];

    if (category === 'correction') {
        rows.push({
            label: 'Tanggal',
            value: formatRequestPeriod({
                ...request,
                payload: { date: request.payload.date },
            }),
        });
        rows.push({
            label: 'Jam diminta',
            value: [
                request.payload.check_in
                    ? `Check-in ${hhmm(request.payload.check_in)}`
                    : null,
                request.payload.check_out
                    ? `Check-out ${hhmm(request.payload.check_out)}`
                    : null,
            ]
                .filter(Boolean)
                .join(' · '),
        });
    } else if (request.minutes !== null) {
        rows.push({ label: 'Waktu', value: formatRequestPeriod(request) });
        rows.push({ label: 'Durasi', value: formatRequestDuration(request) });
    } else {
        rows.push({
            label: 'Tanggal',
            value: formatLongDateRange(request.start_at, request.end_at),
        });
        rows.push({
            label: category === 'leave' ? 'Hari kerja' : 'Durasi',
            value: (
                <>
                    {formatDays(request.days)} hari
                    {request.payload.half_day ? (
                        ' (setengah hari)'
                    ) : (
                        <span className="text-text-muted"> (tanpa libur)</span>
                    )}
                </>
            ),
        });
    }

    if (request.balance) {
        rows.push({
            label: 'Saldo cuti',
            value: (
                <>
                    {formatDays(request.balance.before)} →{' '}
                    <strong className="font-semibold">
                        {formatDays(request.balance.after)} hari
                    </strong>{' '}
                    <span className="text-text-muted">
                        {request.status === 'approved'
                            ? 'sesudah disetujui'
                            : 'setelah disetujui'}
                    </span>
                </>
            ),
        });
    }

    if (request.payload.destination) {
        rows.push({ label: 'Tujuan', value: request.payload.destination });
    }

    rows.push({ label: 'Alasan', value: request.reason || '–' });

    if (category === 'leave') {
        rows.push({
            label: 'Pengganti',
            value: request.substitute ? (
                <span className="inline-flex items-center gap-2">
                    <UserAvatar
                        name={request.substitute.name}
                        src={request.substitute.avatar}
                        className="size-6"
                    />
                    {request.substitute.name}
                </span>
            ) : (
                <span className="text-text-muted">Tidak ada</span>
            ),
        });
    }

    rows.push({
        label: 'Lampiran',
        value:
            request.attachments.length === 0 ? (
                <span className="text-text-muted">Tidak ada</span>
            ) : (
                <ul className="space-y-1">
                    {request.attachments.map((file) => (
                        <li key={file.id}>
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                            >
                                <Paperclip className="size-3.5" aria-hidden />
                                {file.filename}
                                <span className="text-text-muted">
                                    ·{' '}
                                    {formatNumber(
                                        Math.round(file.size_bytes / 1024),
                                    )}{' '}
                                    KB
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            ),
    });

    return (
        <dl
            className={cn(
                'grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-sm',
                className,
            )}
        >
            {rows.map((row) => (
                <div key={row.label} className="contents">
                    <dt className="text-text-muted">{row.label}</dt>
                    <dd className="min-w-0 break-words text-text">
                        {row.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** "Nadia Putri juga cuti pada 13 Okt. Tim Gudang akan kekurangan 2 dari 6 orang." */
export function ColleagueWarning({
    colleagues,
    viewerIsRequester,
    className,
}: {
    colleagues: ColleagueAbsence | null;
    viewerIsRequester?: boolean;
    className?: string;
}) {
    const summary = colleagues ? colleagueSummary(colleagues.people) : null;

    if (!colleagues || !summary) {
        return null;
    }

    const absent = colleagues.people.length + 1;

    return (
        <div
            role="note"
            className={cn(
                'flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] leading-5 text-text',
                className,
            )}
        >
            <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
            />
            <p>
                <strong className="font-semibold">{summary}.</strong>{' '}
                {viewerIsRequester
                    ? 'Atasan Anda akan melihat info ini saat memutuskan.'
                    : colleagues.group
                      ? `${colleagues.group} akan kekurangan ${absent} dari ${colleagues.size} orang di hari itu.`
                      : null}
            </p>
        </div>
    );
}

/** Used · this request · remaining bar ("Terpakai 2 · Pengajuan ini 3 · Sisa 9"). */
export function BalanceBar({
    summary,
    requested,
    className,
}: {
    summary: BalanceSummary;
    requested: number;
    className?: string;
}) {
    const total = Math.max(summary.total, 0.0001);
    const used = summary.used;
    const pending = summary.pending;
    const pct = (value: number) =>
        `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
    const left = Math.max(0, summary.total - used - pending - requested);

    return (
        <div className={className}>
            <div
                className="flex h-2 overflow-hidden rounded-full bg-brand-100 dark:bg-surface-2"
                aria-hidden
            >
                <span
                    className="h-full bg-text-subtle"
                    style={{ width: pct(used) }}
                />
                <span
                    className="h-full bg-warning/70"
                    style={{ width: pct(pending) }}
                />
                <span
                    className="h-full bg-primary"
                    style={{ width: pct(requested) }}
                />
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                <li className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm bg-text-subtle"
                        aria-hidden
                    />
                    Terpakai {formatDays(used)}
                </li>
                {pending > 0 && (
                    <li className="inline-flex items-center gap-1.5">
                        <span
                            className="size-2 rounded-sm bg-warning/70"
                            aria-hidden
                        />
                        Menunggu {formatDays(pending)}
                    </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm bg-primary"
                        aria-hidden
                    />
                    Pengajuan ini {formatDays(requested)}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm bg-brand-100 ring-1 ring-border dark:bg-surface-2"
                        aria-hidden
                    />
                    Sisa {formatDays(left)}
                </li>
            </ul>
        </div>
    );
}

/** "1 Dimas Pratama (atasan langsung) › 2 HR" chips (form summary). */
export function FlowChips({
    steps,
    className,
}: {
    steps: PlannedStep[];
    className?: string;
}) {
    if (steps.length === 0) {
        return (
            <p className="text-sm text-text-muted">
                Alur akan tampil setelah jenis dipilih.
            </p>
        );
    }

    return (
        <ol
            className={cn('flex flex-wrap items-center gap-2', className)}
            aria-label="Alur persetujuan"
        >
            {steps.map((step, index) => (
                <li key={step.step_order} className="flex items-center gap-2">
                    {index > 0 && (
                        <span aria-hidden className="text-text-subtle">
                            ›
                        </span>
                    )}
                    <span
                        title={step.note ?? undefined}
                        className={cn(
                            'inline-flex h-9 items-center gap-2 rounded-full border px-2 pr-3 text-sm',
                            step.status === 'skipped'
                                ? 'border-dashed border-border text-text-muted'
                                : 'border-border bg-surface text-text',
                        )}
                    >
                        <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-muted">
                            {step.step_order}
                        </span>
                        {step.approver ? (
                            <>
                                <UserAvatar
                                    name={step.approver.name}
                                    src={step.approver.avatar}
                                    className="size-5 text-[9px]"
                                />
                                <span
                                    className={cn(
                                        step.status === 'skipped' &&
                                            'line-through',
                                    )}
                                >
                                    {step.approver.name}
                                </span>
                                <span className="text-text-muted">
                                    ({step.label.toLowerCase()})
                                </span>
                            </>
                        ) : (
                            <span
                                className={cn(
                                    step.status === 'skipped' && 'line-through',
                                )}
                            >
                                {step.label}
                            </span>
                        )}
                        {step.status === 'skipped' && (
                            <span className="text-xs text-text-muted">
                                dilewati
                            </span>
                        )}
                    </span>
                </li>
            ))}
        </ol>
    );
}

export function EmptyDetail() {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-14 text-center">
            <FileText
                className="mb-3 size-8 text-text-subtle"
                aria-hidden
                strokeWidth={1.75}
            />
            <p className="text-sm font-semibold text-text">Pilih pengajuan</p>
            <p className="mt-1 text-[13px] text-text-muted">
                Detail dan alur persetujuan tampil di sini.
            </p>
        </div>
    );
}
