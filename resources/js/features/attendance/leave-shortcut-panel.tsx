import { Link } from '@inertiajs/react';
import { CircleHelp, Clock, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { create, show } from '@/routes/requests';
import type { LeaveShortcut } from '@/types/attendance';
import { shortcutQuery, shortcutView } from './leave-shortcut';

type Props = {
    shortcut: LeaveShortcut | undefined;
    /** Ticking server clock of the page. */
    now: Date;
    className?: string;
};

/**
 * "Tidak masuk? Ajukan sakit / izin" under the main action of Absen
 * (keputusan pemilik 14 Okt 2026): two choices that open the request form
 * with the type and today's date filled in, the waiting request instead
 * once one exists, or the plain reason once the same-day cutoff has passed.
 */
export function LeaveShortcutPanel({ shortcut, now, className }: Props) {
    const view = shortcutView(shortcut, now);

    if (view.kind === 'hidden') {
        return null;
    }

    if (view.kind === 'pending') {
        const { pending } = view;

        return (
            <div
                role="status"
                className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-info-soft px-4 py-3 text-[15px] leading-[22px] text-info',
                    className,
                )}
            >
                <Hourglass className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 font-semibold">
                    Pengajuan {pending.typeLabel.toLowerCase()}
                    {pending.number ? ` ${pending.number}` : ''}{' '}
                    {pending.status === 'revision_requested'
                        ? 'perlu direvisi'
                        : 'menunggu persetujuan'}
                    .
                </span>
                <Link
                    href={show.url({ employeeRequest: pending.id })}
                    className="inline-flex min-h-11 items-center font-bold underline-offset-2 hover:underline"
                >
                    Lihat pengajuan
                </Link>
            </div>
        );
    }

    if (view.kind === 'closed') {
        return (
            <p
                role="status"
                className={cn(
                    'flex items-start gap-2.5 rounded-lg bg-surface-2 px-4 py-3 text-[15px] leading-[22px] text-text-muted',
                    className,
                )}
            >
                <Clock className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>
                    {view.reason} Hari ini tercatat alpha bila Anda tidak absen.
                </span>
            </p>
        );
    }

    return (
        <section
            aria-label="Tidak masuk"
            className={cn(
                'flex flex-col gap-3 rounded-lg border border-dashed border-border-strong px-4 py-3.5',
                className,
            )}
        >
            <div className="flex items-start gap-2.5">
                <CircleHelp
                    className="mt-0.5 size-5 shrink-0 text-text-muted"
                    aria-hidden
                />
                <div className="flex min-w-0 flex-col">
                    <h3 className="text-[16px] leading-6 font-bold text-text">
                        Tidak masuk? Ajukan sakit / izin
                    </h3>
                    {view.hint && (
                        <p className="text-[14px] leading-5 text-text-muted">
                            {view.hint} Lewat itu hari ini tercatat alpha.
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
                {view.choices.map((choice) => (
                    <Button
                        key={choice.kind}
                        asChild
                        variant="outline"
                        className="min-w-28 flex-1 sm:flex-none"
                    >
                        <Link
                            href={create.url({
                                query: shortcutQuery(choice, now),
                            })}
                        >
                            Ajukan {choice.label.toLowerCase()}
                        </Link>
                    </Button>
                ))}
            </div>
        </section>
    );
}
