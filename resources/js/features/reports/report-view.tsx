import { ArrowRight, Clock, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, hoursText } from './lib';
import type { DailyReportData } from './types';

function TextBlock({ label, text }: { label: string; text: string | null }) {
    if (!text) {
        return null;
    }

    return (
        <section className="flex flex-col gap-1.5">
            <h3 className="text-[15px] font-bold text-text-muted">{label}</h3>
            <p className="text-[16px] leading-6 break-words whitespace-pre-line text-text">
                {text}
            </p>
        </section>
    );
}

/**
 * Read-only daily report: items (task key/title, note, percent, hours,
 * moved to), summary, blockers and notes. Titles of tasks the reader cannot
 * see arrive as null and only the key is shown.
 */
export function ReportView({
    report,
    className,
}: {
    report: DailyReportData;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-5', className)}>
            {report.items.length === 0 ? (
                <p className="text-[16px] text-text-muted">
                    Tidak ada pekerjaan yang dicatat.
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-divider">
                    {report.items.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                        >
                            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[16px] font-bold text-text">
                                {item.task_key && (
                                    <span className="font-mono text-[14px] font-semibold text-text-muted">
                                        {item.task_key}
                                    </span>
                                )}
                                {item.task_title ? (
                                    <span className="min-w-0 break-words">
                                        {item.task_title}
                                    </span>
                                ) : item.is_task ? (
                                    <span className="inline-flex items-center gap-1.5 font-semibold text-text-muted">
                                        <EyeOff
                                            className="size-4"
                                            aria-hidden
                                        />
                                        Tugas tidak dapat Anda lihat
                                    </span>
                                ) : (
                                    <span>Pekerjaan lain</span>
                                )}
                            </p>
                            <p className="text-[16px] leading-6 break-words whitespace-pre-line text-text">
                                {item.progress_note}
                            </p>
                            {(item.percent !== null ||
                                item.hours !== null ||
                                item.status_category_after) && (
                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-text-muted">
                                    {item.percent !== null && (
                                        <span className="tnum">
                                            Progres {item.percent}%
                                        </span>
                                    )}
                                    {item.hours !== null && (
                                        <span className="inline-flex items-center gap-1 tnum">
                                            <Clock
                                                className="size-3.5"
                                                aria-hidden
                                            />
                                            {hoursText(item.hours)}
                                        </span>
                                    )}
                                    {item.status_category_after && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-link">
                                            <ArrowRight
                                                className="size-3.5"
                                                aria-hidden
                                            />
                                            {
                                                CATEGORY_LABELS[
                                                    item.status_category_after
                                                ]
                                            }
                                        </span>
                                    )}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <TextBlock label="Ringkasan" text={report.summary} />
            <TextBlock label="Hambatan" text={report.blockers} />
            <TextBlock label="Catatan / notulensi" text={report.notes} />
        </div>
    );
}
