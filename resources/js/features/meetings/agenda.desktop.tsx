import { Link } from '@inertiajs/react';
import { CalendarDays, CalendarPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/tabs';
import { formatTime } from '@/lib/format';
import {
    FollowUpsPanel,
    NextMeetingHero,
    RemindersPanel,
    AgendaRow,
} from './agenda-parts';
import { DayTabs } from './day-tabs';
import { longDate, meetingsOn, shortDate } from './lib';
import { LiveMeetingBanner, MeetingStartNotice } from './meeting-notice';
import {
    ErrorState,
    ListSkeleton,
    PreviewBar,
    SyncChip,
    useMeetingActions,
} from './meeting-ui';
import type { AgendaData } from './use-agenda';

type View = 'day' | 'week';

export const AGENDA_PREVIEWS = [
    { label: 'Rapat berlangsung', query: 'jam=10.42' },
];

/** /rapat on desktop & tablet (design DRapat). */
export function AgendaDesktop({
    data,
    isTablet,
}: {
    data: AgendaData;
    isTablet: boolean;
}) {
    const [view, setView] = useState<View>('day');
    const liveActions = useMeetingActions(data.live);
    const todayCount = meetingsOn(data.meetings, data.today).length;

    return (
        <div className="flex flex-col gap-6">
            <PreviewBar extra={AGENDA_PREVIEWS} />

            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <span className="text-overline text-link">
                        {longDate(data.today)} · {formatTime(data.now)}
                    </span>
                    <h1 className="text-display">Rapat</h1>
                    <span className="text-[18px] text-text-muted">
                        {data.state === 'normal' || data.state === 'kosong'
                            ? `${todayCount} rapat hari ini · ${data.pendingMinutes} notulen menunggu Anda`
                            : 'Memuat jadwal rapat…'}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <SyncChip sync={data.sync} now={data.now} />
                    <Button variant="outline" size="lg" asChild>
                        <Link href="/kalender">
                            <CalendarDays aria-hidden />
                            Kalender
                        </Link>
                    </Button>
                    <Button size="lg" asChild>
                        <Link href="/rapat/baru">
                            <Plus aria-hidden />
                            Jadwalkan rapat
                        </Link>
                    </Button>
                </div>
            </section>

            {data.state === 'memuat' ? (
                <>
                    <ListSkeleton rows={1} className="[&>div]:h-48" />
                    <ListSkeleton rows={4} />
                </>
            ) : data.state === 'galat' ? (
                <ErrorState
                    title="Jadwal rapat gagal dimuat"
                    description="Google Calendar tidak menjawab. Data yang tersimpan tetap aman; coba muat ulang sebentar lagi."
                />
            ) : data.meetings.length === 0 ? (
                <EmptyState
                    icon={CalendarPlus}
                    title="Belum ada rapat minggu ini"
                    description="Rapat yang Anda adakan atau ikuti akan tampil di sini, lengkap dengan tautan Google Meet."
                    action={
                        <Button asChild>
                            <Link href="/rapat/baru">Jadwalkan rapat</Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    {data.live && !liveActions.joined && (
                        <LiveMeetingBanner
                            meeting={data.live}
                            now={data.now}
                            onJoin={liveActions.join}
                        />
                    )}
                    {data.next && (
                        <NextMeetingHero
                            meeting={data.next}
                            now={data.now}
                            actions={data.live ? liveActions : undefined}
                        />
                    )}

                    <section className="flex flex-wrap items-start gap-5">
                        <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h2 className="text-h3">
                                    {view === 'day'
                                        ? data.day === data.today
                                            ? 'Hari ini'
                                            : longDate(data.day)
                                        : 'Minggu ini'}
                                </h2>
                                <SegmentedTabs
                                    label="Tampilan agenda"
                                    value={view}
                                    onValueChange={setView}
                                    options={[
                                        { value: 'day', label: 'Per hari' },
                                        { value: 'week', label: 'Minggu ini' },
                                    ]}
                                />
                            </div>
                            {view === 'day' ? (
                                <>
                                    <DayTabs
                                        dates={data.days}
                                        value={data.day}
                                        onChange={data.setDay}
                                        counts={data.counts}
                                        today={data.today}
                                    />
                                    <AgendaCard
                                        meetings={data.dayMeetings}
                                        now={data.now}
                                    />
                                </>
                            ) : (
                                data.weekMeetings.map(({ date, meetings }) => (
                                    <section
                                        key={date}
                                        aria-label={shortDate(date)}
                                        className="flex flex-col gap-2"
                                    >
                                        <h3 className="text-overline text-text-muted">
                                            {shortDate(date)}
                                            {date === data.today
                                                ? ' · hari ini'
                                                : ''}
                                        </h3>
                                        <AgendaCard
                                            meetings={meetings}
                                            now={data.now}
                                        />
                                    </section>
                                ))
                            )}
                        </div>
                        <aside
                            className={
                                isTablet
                                    ? 'flex min-w-0 flex-[1_1_100%] flex-col gap-4 md:flex-row [&>*]:flex-1'
                                    : 'flex min-w-0 flex-[1_1_340px] flex-col gap-4'
                            }
                        >
                            <FollowUpsPanel
                                items={data.followUps}
                                today={data.today}
                            />
                            <RemindersPanel
                                onPreview={
                                    data.next
                                        ? () => data.setNoticeOpen(true)
                                        : undefined
                                }
                            />
                        </aside>
                    </section>
                </>
            )}

            {data.next && (
                <MeetingStartNotice
                    meeting={data.next}
                    now={data.now}
                    open={data.noticeOpen}
                    onOpenChange={data.setNoticeOpen}
                    variant={isTablet ? 'tablet' : 'desktop'}
                />
            )}
        </div>
    );
}

function AgendaCard({
    meetings,
    now,
}: {
    meetings: AgendaData['dayMeetings'];
    now: number;
}) {
    if (meetings.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CalendarDays}
                title="Tidak ada rapat"
                className="bg-surface"
            >
                Hari ini kosong dari rapat. Waktu yang pas untuk fokus.
            </EmptyState>
        );
    }

    return (
        <ul className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
            {meetings.map((meeting) => (
                <AgendaRow key={meeting.id} meeting={meeting} now={now} />
            ))}
        </ul>
    );
}
