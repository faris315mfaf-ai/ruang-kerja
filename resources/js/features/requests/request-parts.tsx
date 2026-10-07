import { AlertTriangle, FileText, Paperclip, ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    colleagueSummary,
    formatDays,
    formatLongDateRange,
    formatRequestDuration,
    formatRequestPeriod,
    formatRupiah,
    formatShortDate,
} from '@/lib/requests';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    BalanceSummary,
    ColleagueAbsence,
    PlannedStep,
    RequestDetail,
} from '@/types/requests';

/** Shown instead of reason/attachments of a sick request to a substitute approver. */
export const HEALTH_HIDDEN_NOTICE =
    'Detail kesehatan disembunyikan untuk penyetuju pengganti';

function hhmm(value: string | null | undefined): string {
    return value ? value.slice(0, 5).replace(':', '.') : '–';
}

/** Label/value rows of a request (detail panel, mobile detail card). */
export function RequestFields({
    request,
    withPeriod = true,
    className,
}: {
    request: RequestDetail;
    /** False when the period is already shown elsewhere (approval tiles). */
    withPeriod?: boolean;
    className?: string;
}) {
    const category = request.type.category;
    const rows: { label: string; value: React.ReactNode }[] = [];

    if (category === 'procurement') {
        // Pengajuan barang (keputusan pemilik 6 Okt 2026).
        const p = request.payload;

        if (withPeriod) {
            rows.push({
                label: 'Tanggal kirim',
                value: formatShortDate(
                    request.submitted_at ?? request.start_at,
                ),
            });
        }

        rows.push({ label: 'Barang', value: p.item_name ?? '–' });
        rows.push({
            label: 'Jumlah',
            value: `${formatNumber(p.quantity ?? null)} ${p.unit ?? 'unit'}`,
        });
        rows.push({
            label: 'Harga satuan',
            value: (
                <span className="tnum">
                    {formatRupiah(p.unit_price)}{' '}
                    <span className="text-text-muted">(perkiraan)</span>
                </span>
            ),
        });
        rows.push({
            label: 'Total',
            value: (
                <strong className="font-semibold tnum">
                    {formatRupiah(p.total)}
                </strong>
            ),
        });
        rows.push({
            label: 'Kebutuhan',
            value:
                p.urgency === 'mendesak' ? (
                    <span className="font-semibold text-danger">Mendesak</span>
                ) : (
                    'Biasa'
                ),
        });

        if (p.reference_url && /^https?:\/\//i.test(p.reference_url)) {
            rows.push({
                label: 'Referensi',
                value: (
                    <a
                        href={p.reference_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-semibold break-all text-link underline-offset-4 hover:underline"
                    >
                        {p.reference_url}
                    </a>
                ),
            });
        }
    } else if (!withPeriod) {
        // Period rows are shown by the caller.
    } else if (category === 'correction') {
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
        const calendar = request.type.counts_calendar_days === true;

        rows.push({
            label: category === 'leave' && !calendar ? 'Hari kerja' : 'Durasi',
            value: (
                <>
                    {formatDays(request.days)}{' '}
                    {calendar ? 'hari kalender' : 'hari'}
                    {request.payload.half_day ? (
                        ' (setengah hari)'
                    ) : calendar ? null : (
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

    const hidden = request.health_details_hidden === true;
    const hiddenNotice = (
        <span className="inline-flex items-center gap-1.5 text-text-muted">
            <ShieldOff className="size-4 shrink-0" aria-hidden />
            {HEALTH_HIDDEN_NOTICE}
        </span>
    );

    rows.push({
        label: 'Alasan',
        value: hidden ? hiddenNotice : request.reason || '–',
    });

    if (category === 'leave') {
        rows.push({
            label: 'Pengganti',
            value: request.substitute ? (
                <span className="inline-flex items-center gap-2">
                    <UserAvatar
                        name={request.substitute.name}
                        src={request.substitute.avatar}
                        className="size-7"
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
        value: hidden ? (
            hiddenNotice
        ) : request.attachments.length === 0 ? (
            <span className="text-text-muted">Tidak ada</span>
        ) : (
            <ul className="space-y-1">
                {request.attachments.map((file) => (
                    <li key={file.id}>
                        <a
                            href={file.url}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-link underline-offset-4 hover:underline"
                        >
                            <Paperclip className="size-4" aria-hidden />
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
                'grid grid-cols-[112px_1fr] gap-x-4 gap-y-3 text-[16px] leading-6 md:grid-cols-[140px_1fr] md:gap-x-5',
                className,
            )}
        >
            {rows.map((row) => (
                <div key={row.label} className="contents">
                    <dt className="text-[15px] font-semibold text-text-muted">
                        {row.label}
                    </dt>
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
                'flex gap-3 rounded-lg bg-warning-soft px-4 py-3 text-[15px] leading-[22px] text-text',
                className,
            )}
        >
            <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-warning"
                aria-hidden
            />
            <p>
                <strong className="font-bold">{summary}.</strong>{' '}
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
                className="flex h-2.5 overflow-hidden rounded-full bg-surface-2"
                aria-hidden
            >
                <span
                    className="h-full bg-text-subtle"
                    style={{ width: pct(used) }}
                />
                <span
                    className="h-full bg-fill-warning"
                    style={{ width: pct(pending) }}
                />
                <span
                    className="h-full bg-grad-merek-x"
                    style={{ width: pct(requested) }}
                />
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-meta text-text-muted">
                <li className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full bg-text-subtle"
                        aria-hidden
                    />
                    Terpakai {formatDays(used)}
                </li>
                {pending > 0 && (
                    <li className="inline-flex items-center gap-1.5">
                        <span
                            className="size-2.5 rounded-full bg-fill-warning"
                            aria-hidden
                        />
                        Menunggu {formatDays(pending)}
                    </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full bg-grad-merek-x"
                        aria-hidden
                    />
                    Pengajuan ini {formatDays(requested)}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full bg-surface-2 ring-1 ring-border"
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
            <p className="text-[15px] text-text-muted">
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
                            'inline-flex min-h-10 items-center gap-2 rounded-[20px] border py-1.5 pr-3.5 pl-2 text-[15px] leading-5 font-semibold',
                            step.status === 'skipped'
                                ? 'border-dashed border-border text-text-muted'
                                : 'border-border bg-surface text-text',
                        )}
                    >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-bold text-text-muted">
                            {step.step_order}
                        </span>
                        {step.approver ? (
                            <>
                                <UserAvatar
                                    name={step.approver.name}
                                    src={step.approver.avatar}
                                    className="size-6 shrink-0 text-[10px]"
                                />
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            step.status === 'skipped' &&
                                                'line-through',
                                        )}
                                    >
                                        {step.approver.name}
                                    </span>{' '}
                                    <span className="font-normal text-text-muted">
                                        ({step.label.toLowerCase()})
                                    </span>
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
                            <span className="text-meta font-normal text-text-muted">
                                dilewati
                            </span>
                        )}
                    </span>
                </li>
            ))}
        </ol>
    );
}

/** Right panel before a row is picked. */
export function EmptyDetail({
    description = 'Detail dan alur persetujuan tampil di sini.',
}: {
    description?: string;
}) {
    return (
        <EmptyState
            icon={FileText}
            title="Pilih pengajuan"
            description={description}
        />
    );
}
