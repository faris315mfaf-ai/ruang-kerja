import { CircleAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    dayUnit,
    formatDateRange,
    formatDays,
    formatHours,
    formatLongDateRange,
} from '@/lib/requests';
import { cn } from '@/lib/utils';
import { MonthCalendar } from './month-calendar';
import { BalanceBar, ColleagueWarning, FlowChips } from './request-parts';
import type { RequestFormState } from './use-request-form';

/**
 * "Ringkasan" of the form: duration, balance before → after, calendar,
 * colleagues absent and the approval flow (live preview).
 */
export function RequestSummary({
    state,
    today,
    mobile = false,
}: {
    state: RequestFormState;
    today: string;
    mobile?: boolean;
}) {
    const { preview, previewing, previewFailed, type, category } = state;
    const period = preview?.period ?? null;
    const errors = preview?.errors
        ? Object.values(preview.errors).filter(Boolean)
        : [];

    if (!preview) {
        return (
            <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    const headline =
        period === null
            ? '—'
            : period.minutes !== null
              ? formatHours(period.minutes)
              : period.days !== null
                ? `${formatDays(period.days)} ${type ? dayUnit(type) : dayUnit({ category })}`
                : 'Koreksi 1 hari';

    const marked = (preview.colleagues?.people ?? []).flatMap(
        (person) => person.dates,
    );
    const when =
        period === null
            ? '—'
            : period.minutes !== null
              ? formatDateRange(period.start_at, period.start_at)
              : formatLongDateRange(period.start_at, period.end_at);
    const rows = mobile
        ? [{ k: 'Durasi', v: headline }]
        : [
              { k: 'Jenis', v: type?.name ?? '—' },
              { k: 'Tanggal', v: when },
              { k: 'Durasi', v: headline },
          ];

    return (
        <div
            className={cn(
                'flex flex-col gap-4',
                previewing && 'opacity-70 transition-opacity',
            )}
            aria-live="polite"
        >
            <dl className="flex flex-col">
                {rows.map((row) => (
                    <div
                        key={row.k}
                        className="flex justify-between gap-3 border-b border-divider py-3 text-[16px] first:pt-0"
                    >
                        <dt className="text-text-muted">{row.k}</dt>
                        <dd className="text-right font-bold text-text">
                            {row.v}
                        </dd>
                    </div>
                ))}
            </dl>

            {preview.balance && type && (
                <div className="flex flex-col gap-2">
                    <p className="flex justify-between gap-3 text-[15px] text-text-muted">
                        <span>Saldo {type.name.toLowerCase()}</span>
                        <span className="tnum">
                            <b className="text-text">
                                {formatDays(preview.balance.before)}
                            </b>{' '}
                            →{' '}
                            <b className="text-primary">
                                {formatDays(preview.balance.after)} hari
                            </b>
                        </span>
                    </p>
                    <BalanceBar
                        summary={preview.balance.summary}
                        requested={period?.days ?? 0}
                    />
                    {!preview.balance.enough && (
                        <p className="text-meta font-semibold text-danger">
                            Saldo tidak cukup untuk pengajuan ini.
                        </p>
                    )}
                </div>
            )}

            {!mobile &&
                period &&
                period.minutes === null &&
                period.work_dates.length > 0 && (
                    <MonthCalendar
                        month={period.work_dates[0]}
                        today={today}
                        selected={period.work_dates}
                        marked={marked}
                    />
                )}

            {(preview.overlap || errors.length > 0 || previewFailed) && (
                <div
                    role="alert"
                    className="flex gap-2.5 rounded-lg bg-danger-soft px-4 py-3 text-[15px] leading-[22px] text-danger"
                >
                    <CircleAlert
                        className="mt-0.5 size-5 shrink-0"
                        aria-hidden
                    />
                    <div className="flex flex-col gap-1">
                        {preview.overlap && <p>{preview.overlap}</p>}
                        {errors.map((message) => (
                            <p key={message}>{message}</p>
                        ))}
                        {previewFailed && (
                            <p>Ringkasan gagal dimuat. Periksa koneksi Anda.</p>
                        )}
                    </div>
                </div>
            )}

            <ColleagueWarning
                colleagues={preview.colleagues}
                viewerIsRequester
            />

            <div className="flex flex-col gap-2.5">
                <p className="text-[15px] font-bold text-text-muted">
                    Akan disetujui oleh
                </p>
                <FlowChips steps={preview.flow} />
            </div>
        </div>
    );
}
