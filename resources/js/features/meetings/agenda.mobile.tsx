import { Link } from '@inertiajs/react';
import { BellRing, CalendarDays, CalendarPlus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    AgendaRowCompact,
    FollowUpsPanel,
    NextMeetingHero,
} from './agenda-parts';
import { AGENDA_PREVIEWS } from './agenda.desktop';
import { DayTabs } from './day-tabs';
import { LiveMeetingBanner, MeetingStartNotice } from './meeting-notice';
import {
    ErrorState,
    ListSkeleton,
    PreviewBar,
    SyncChip,
    useMeetingActions,
} from './meeting-ui';
import type { AgendaData } from './use-agenda';

/** /rapat on phones (design MRapat): day tiles, hero, compact list. */
export function AgendaMobile({ data }: { data: AgendaData }) {
    const liveActions = useMeetingActions(data.live);
    const showHero = data.next && data.day === data.today;

    return (
        <div className="flex flex-col gap-3.5">
            <PreviewBar extra={AGENDA_PREVIEWS} />

            {data.state === 'memuat' ? (
                <ListSkeleton rows={5} />
            ) : data.state === 'galat' ? (
                <ErrorState
                    title="Jadwal rapat gagal dimuat"
                    description="Periksa koneksi lalu coba lagi."
                />
            ) : data.meetings.length === 0 ? (
                <EmptyState
                    icon={CalendarPlus}
                    title="Belum ada rapat minggu ini"
                    description="Rapat yang Anda adakan atau ikuti tampil di sini."
                    action={
                        <Button size="lg" asChild>
                            <Link href="/rapat/baru">Jadwalkan rapat</Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <DayTabs
                        dates={data.days}
                        value={data.day}
                        onChange={data.setDay}
                        today={data.today}
                    />
                    {data.live &&
                        !liveActions.joined &&
                        data.day === data.today && (
                            <LiveMeetingBanner
                                meeting={data.live}
                                now={data.now}
                                onJoin={liveActions.join}
                            />
                        )}
                    {showHero && data.next && (
                        <NextMeetingHero
                            meeting={data.next}
                            now={data.now}
                            compact
                            actions={data.live ? liveActions : undefined}
                        />
                    )}
                    {data.dayMeetings.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={CalendarDays}
                            title="Tidak ada rapat"
                            className="bg-surface"
                        >
                            Tidak ada rapat di hari ini.
                        </EmptyState>
                    ) : (
                        <ul className="overflow-hidden rounded-[22px] border border-border bg-surface">
                            {data.dayMeetings.map((meeting) => (
                                <AgendaRowCompact
                                    key={meeting.id}
                                    meeting={meeting}
                                    now={data.now}
                                />
                            ))}
                        </ul>
                    )}
                    <FollowUpsPanel items={data.followUps} today={data.today} />
                    <div className="flex flex-col gap-2.5">
                        <SyncChip
                            sync={data.sync}
                            now={data.now}
                            className="h-auto min-h-11 w-full justify-start py-2 whitespace-normal"
                        />
                        <div className="grid grid-cols-2 gap-2.5">
                            <Button
                                variant="outline"
                                size="lg"
                                className="px-3"
                                asChild
                            >
                                <Link href="/kalender">
                                    <CalendarDays aria-hidden />
                                    Kalender
                                </Link>
                            </Button>
                            {data.next && (
                                <Button
                                    variant="tonal"
                                    size="lg"
                                    className="px-3"
                                    onClick={() => data.setNoticeOpen(true)}
                                >
                                    <BellRing aria-hidden />
                                    Contoh notifikasi
                                </Button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {data.next && (
                <MeetingStartNotice
                    meeting={data.next}
                    now={data.now}
                    open={data.noticeOpen}
                    onOpenChange={data.setNoticeOpen}
                    variant="mobile"
                />
            )}
        </div>
    );
}
