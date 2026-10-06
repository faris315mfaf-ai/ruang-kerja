import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, PenLine } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_TONES, hoursText, statusText } from '@/features/reports/lib';
import { ReportView } from '@/features/reports/report-view';
import type { DailyReportData, ReportPerson } from '@/features/reports/types';
import { formatLongDate } from '@/lib/format';

type Props = {
    owner: ReportPerson;
    mine: boolean;
    report: DailyReportData;
};

/** /laporan/{user}/{date}: one daily report (owner or a reader). */
export default function ReportShow({ owner, mine, report }: Props) {
    const back = mine ? '/laporan' : `/laporan/${owner.id}`;
    const meta = [
        `${report.items_count} pekerjaan`,
        hoursText(report.hours),
    ].filter(Boolean);

    return (
        <>
            <Head title={`Laporan ${formatLongDate(report.date)}`} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                <Button
                    asChild
                    variant="quiet"
                    className="-ml-3 self-start text-[16px] max-md:hidden"
                >
                    <Link href={back}>
                        <ChevronLeft aria-hidden strokeWidth={2.2} />
                        {mine ? 'Laporan saya' : `Laporan ${owner.name}`}
                    </Link>
                </Button>
                <header className="flex flex-wrap items-center gap-3">
                    <UserAvatar
                        name={owner.name}
                        src={owner.avatar}
                        className="size-12"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <p className="text-overline text-text-muted">
                            {formatLongDate(report.date)}
                        </p>
                        <h1 className="truncate text-h2 text-text">
                            {owner.name}
                        </h1>
                        <p className="text-meta text-text-muted">
                            {[owner.position, owner.division, ...meta]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                    <Badge
                        variant="status"
                        tone={STATUS_TONES[report.status]}
                        dot
                    >
                        {statusText(report.status, report.submitted_at)}
                    </Badge>
                </header>

                <section className="rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
                    <ReportView report={report} />
                </section>

                {mine && report.editable && (
                    <Button asChild size="lg" className="self-start">
                        <Link href="/laporan/hari-ini">
                            <PenLine aria-hidden />
                            Ubah laporan hari ini
                        </Link>
                    </Button>
                )}
            </div>
        </>
    );
}

ReportShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Laporan', href: '/laporan' },
        { title: formatLongDate(props.report.date), href: '' },
    ],
    title: 'Detail laporan',
    back: props.mine ? '/laporan' : `/laporan/${props.owner.id}`,
});
