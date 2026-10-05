import { CircleAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
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
            <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-40" />
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
                ? `${formatDays(period.days)} ${category === 'leave' ? 'hari kerja' : 'hari'}`
                : 'Koreksi 1 hari';

    const marked = (preview.colleagues?.people ?? []).flatMap(
        (person) => person.dates,
    );

    return (
        <div
            className={cn(
                'space-y-4',
                previewing && 'opacity-70 transition-opacity',
            )}
            aria-live="polite"
        >
            <div
                className={cn(mobile && 'flex items-end justify-between gap-3')}
            >
                <div>
                    {!mobile && (
                        <p className="text-[13px] text-text-muted">Ringkasan</p>
                    )}
                    <p
                        className={cn(
                            'font-semibold text-text',
                            mobile ? 'text-[26px] leading-8' : 'mt-1 text-2xl',
                        )}
                    >
                        {headline}
                    </p>
                    {period && (
                        <p className="text-sm text-text-muted">
                            {period.minutes !== null
                                ? formatDateRange(
                                      period.start_at,
                                      period.start_at,
                                  )
                                : mobile
                                  ? 'tanpa libur & akhir pekan'
                                  : formatLongDateRange(
                                        period.start_at,
                                        period.end_at,
                                    )}
                        </p>
                    )}
                </div>
                {mobile && preview.balance && type && (
                    <div className="text-right">
                        <p className="text-[13px] text-text-muted">
                            Saldo {type.name.toLowerCase()}
                        </p>
                        <p className="text-lg text-text tnum">
                            {formatDays(preview.balance.before)} →{' '}
                            <strong>
                                {formatDays(preview.balance.after)} hari
                            </strong>
                        </p>
                    </div>
                )}
            </div>

            {preview.balance && type && (
                <div>
                    {!mobile && (
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium text-text">
                                Saldo {type.name.toLowerCase()}
                            </span>
                            <span className="text-text-muted tnum">
                                {formatDays(preview.balance.before)} →{' '}
                                <strong className="text-text">
                                    {formatDays(preview.balance.after)} hari
                                </strong>
                            </span>
                        </div>
                    )}
                    <BalanceBar
                        summary={preview.balance.summary}
                        requested={period?.days ?? 0}
                    />
                    {!preview.balance.enough && (
                        <p className="mt-2 text-[13px] text-danger">
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
                    className="flex gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-[13px] text-danger"
                >
                    <CircleAlert
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                    />
                    <div className="space-y-1">
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

            <div
                className={cn(
                    mobile && '-mx-4 border-t border-border px-4 pt-4',
                )}
            >
                <p className="mb-2 text-sm font-medium text-text">
                    Alur persetujuan
                </p>
                <FlowChips steps={preview.flow} />
            </div>
        </div>
    );
}
