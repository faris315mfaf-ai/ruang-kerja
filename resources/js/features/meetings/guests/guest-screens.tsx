import {
    CalendarClock,
    Clock,
    Link2Off,
    PhoneOff,
    RefreshCw,
    ShieldCheck,
    UserX,
    Video,
    WifiOff,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useId } from 'react';
import { BrandMark } from '@/components/shell/brand-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { officeZoneLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { officeDate, shortDate, timeRange } from '../lib';
import { GUEST_NAME_MAX } from './lib';
import type { WindowNotice } from './lib';
import type { GuestInfo } from './types';

/**
 * Chrome of every guest screen: the app mark on the room desk and a centred
 * column. Deliberately no menu, Dock or links into the app: a guest has no
 * account and sees nothing of RuangKerja beyond this meeting.
 */
export function GuestShell({
    children,
    wide = false,
}: {
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <div className="min-h-dvh bg-room-desk text-text">
            <div
                className={cn(
                    'mx-auto flex w-full flex-col gap-6 px-4 pt-[max(20px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] md:pt-12',
                    wide ? 'max-w-[1100px] md:px-10' : 'max-w-[520px]',
                )}
            >
                <BrandMark withName size="sm" />
                {children}
            </div>
        </div>
    );
}

const DEFAULT_NOTICE = [
    'Anda masuk sebagai tamu: video, suara, berbagi layar, dan obrolan rapat.',
    'Suara dan video Anda tidak direkam dan tidak ditranskrip.',
    'Penyelenggara mencatat nama, alamat IP, dan waktu masuk Anda.',
];

/** "Senin, 5 Okt · 10.00–11.00 WIB" (zone of the office timezone). */
export function meetingWhen(meeting: NonNullable<GuestInfo['meeting']>) {
    return `${shortDate(officeDate(meeting.starts_at))} · ${timeRange(meeting.starts_at, meeting.ends_at)} ${officeZoneLabel()}`;
}

function MeetingHeader({ info }: { info: GuestInfo }) {
    const meeting = info.meeting;

    if (!meeting) {
        return null;
    }

    return (
        <header className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-link-soft px-2.5 py-1 text-[13px] font-bold text-link">
                <Video aria-hidden className="size-3.5" />
                Rapat video
            </span>
            <h1 className="text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] break-words md:text-[30px] md:leading-[38px]">
                {meeting.title}
            </h1>
            <p className="text-[16px] text-text-muted">
                {meetingWhen(meeting)}
            </p>
            {meeting.organizer_name && (
                <p className="text-[15px] text-text-muted">
                    Penyelenggara: {meeting.organizer_name}
                </p>
            )}
        </header>
    );
}

function Card({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'flex flex-col gap-5 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6',
                className,
            )}
        >
            {children}
        </section>
    );
}

function Banner({ notice }: { notice: WindowNotice }) {
    return (
        <p
            role="status"
            className={cn(
                'flex items-start gap-2.5 rounded-control px-4 py-3 text-[15px] leading-[22px]',
                notice.tone === 'danger'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-info-soft text-info',
            )}
        >
            <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0" />
            {notice.text}
        </p>
    );
}

/** Step 1: meeting info, privacy note and the name form. */
export function GuestRequestForm({
    info,
    name,
    onName,
    nameError,
    formError,
    submitting,
    onSubmit,
    notice,
    blocked,
}: {
    info: GuestInfo;
    name: string;
    onName: (value: string) => void;
    nameError: string | null;
    formError: string | null;
    submitting: boolean;
    onSubmit: () => void;
    notice: WindowNotice | null;
    /** Window shut (server): the form cannot be submitted. */
    blocked: boolean;
}) {
    const id = useId();
    const points = info.notice_points?.length
        ? info.notice_points
        : DEFAULT_NOTICE;
    const unavailable = info.features?.video_configured === false;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit();
    };

    return (
        <>
            <MeetingHeader info={info} />
            <Card>
                {notice && <Banner notice={notice} />}
                {unavailable && (
                    <p
                        role="status"
                        className="rounded-control bg-warning-soft px-4 py-3 text-[15px] leading-[22px] text-warning"
                    >
                        Ruang video belum disiapkan di server. Hubungi
                        penyelenggara rapat.
                    </p>
                )}
                <form
                    onSubmit={submit}
                    noValidate
                    className="flex flex-col gap-4"
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={id}>Nama Anda</Label>
                        <Input
                            id={id}
                            name="name"
                            value={name}
                            maxLength={GUEST_NAME_MAX + 20}
                            autoComplete="name"
                            autoCapitalize="words"
                            enterKeyHint="go"
                            placeholder="Mis. Budi Santoso"
                            aria-invalid={nameError ? true : undefined}
                            aria-describedby={`${id}-help`}
                            onChange={(event) => onName(event.target.value)}
                            className="h-12 text-[17px] md:text-[16px]"
                        />
                        <p
                            id={`${id}-help`}
                            role={nameError ? 'alert' : undefined}
                            className={cn(
                                'text-[14px] leading-5',
                                nameError ? 'text-danger' : 'text-text-muted',
                            )}
                        >
                            {nameError ??
                                'Peserta lain melihat Anda sebagai “Nama (Tamu)”.'}
                        </p>
                    </div>
                    {formError && (
                        <p
                            role="alert"
                            className="rounded-control bg-danger-soft px-4 py-3 text-[15px] text-danger"
                        >
                            {formError}
                        </p>
                    )}
                    <Button
                        type="submit"
                        size="xl"
                        className="w-full text-[17px] font-bold"
                        disabled={submitting || blocked || unavailable}
                    >
                        {submitting && <Spinner />}
                        Minta masuk
                    </Button>
                </form>
                <aside
                    aria-label="Privasi"
                    className="flex flex-col gap-2 rounded-control bg-surface-2 px-4 py-3.5"
                >
                    <h2 className="flex items-center gap-2 text-[14px] font-bold">
                        <ShieldCheck
                            aria-hidden
                            className="size-4 text-text-muted"
                        />
                        Sebelum masuk
                    </h2>
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px] leading-5 text-text-muted">
                        {points.map((point) => (
                            <li key={point}>{point}</li>
                        ))}
                        <li>
                            Anda tidak bisa melihat notulen, tugas, atau data
                            lain di aplikasi.
                        </li>
                    </ul>
                </aside>
            </Card>
        </>
    );
}

/** Step 2: waiting for the organizer (status polled in the background). */
export function GuestWaiting({
    info,
    name,
    offline,
}: {
    info: GuestInfo;
    name: string;
    offline: boolean;
}) {
    return (
        <>
            <MeetingHeader info={info} />
            <Card className="items-center text-center">
                <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-muted"
                >
                    <Clock className="size-7" />
                </span>
                <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-col gap-2"
                >
                    <h2 className="text-[22px] leading-7 font-extrabold">
                        Menunggu diizinkan masuk
                    </h2>
                    <p className="text-[16px] leading-6 text-text-muted">
                        {name.trim() !== '' && `${name.trim()}, `}
                        penyelenggara akan menerima permintaan Anda. Biarkan
                        halaman ini terbuka, Anda masuk otomatis begitu
                        diizinkan.
                    </p>
                </div>
                <span className="inline-flex items-center gap-2 text-[14px] text-text-muted">
                    <Spinner className="size-4" />
                    Memeriksa setiap beberapa detik
                </span>
                {offline && (
                    <p
                        role="alert"
                        className="flex items-start gap-2 rounded-control bg-warning-soft px-4 py-3 text-left text-[14px] leading-5 text-warning"
                    >
                        <WifiOff
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0"
                        />
                        Koneksi Anda bermasalah. Kami terus mencoba, status
                        permintaan Anda tidak hilang.
                    </p>
                )}
            </Card>
        </>
    );
}

type FinalKind = 'denied' | 'removed' | 'expired' | 'closed' | 'unknown';

const FINAL: Record<
    FinalKind,
    { icon: ReactNode; title: string; body: string }
> = {
    denied: {
        icon: <UserX />,
        title: 'Penyelenggara menolak permintaan Anda',
        body: 'Hubungi penyelenggara bila ini keliru. Penyelenggara yang bisa mengizinkan Anda masuk.',
    },
    removed: {
        icon: <PhoneOff />,
        title: 'Anda dikeluarkan dari rapat',
        body: 'Penyelenggara mengeluarkan Anda dari ruang rapat. Hubungi penyelenggara, lalu periksa lagi setelah diizinkan masuk kembali.',
    },
    expired: {
        icon: <Link2Off />,
        title: 'Tautan sudah kedaluwarsa',
        body: 'Minta tautan baru kepada penyelenggara rapat.',
    },
    closed: {
        icon: <PhoneOff />,
        title: 'Rapat sudah selesai',
        body: 'Ruang rapat ini sudah ditutup. Terima kasih.',
    },
    unknown: {
        icon: <Link2Off />,
        title: 'Tautan tidak berlaku',
        body: 'Tautan ini salah ketik, sudah diganti, atau dicabut. Minta tautan baru kepada penyelenggara rapat.',
    },
};

/** Terminal states: rejected, removed, expired, ended, unknown link. */
export function GuestFinal({
    kind,
    info,
    onCheckAgain,
    checking,
}: {
    kind: FinalKind;
    info?: GuestInfo;
    /** Removed guests can re-check once the organizer lets them in again. */
    onCheckAgain?: () => void;
    checking?: boolean;
}) {
    const copy = FINAL[kind];

    return (
        <>
            {kind !== 'unknown' && info && <MeetingHeader info={info} />}
            <Card className="items-center text-center">
                <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-muted [&_svg]:size-7"
                >
                    {copy.icon}
                </span>
                <div role="status" className="flex flex-col gap-2">
                    <h2 className="text-[22px] leading-7 font-extrabold">
                        {copy.title}
                    </h2>
                    <p className="text-[16px] leading-6 text-text-muted">
                        {copy.body}
                    </p>
                </div>
                {kind === 'removed' && onCheckAgain && (
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={onCheckAgain}
                        disabled={checking}
                    >
                        {checking ? <Spinner /> : <RefreshCw aria-hidden />}
                        Periksa lagi
                    </Button>
                )}
            </Card>
        </>
    );
}
