import { router } from '@inertiajs/react';
import {
    BellOff,
    Camera,
    ChevronRight,
    CircleAlert,
    CircleCheck,
    Flashlight,
    ScanFace,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn, focusRing } from '@/lib/utils';
import { LOCK_NOTIFICATIONS } from './fixtures';
import { HomeIndicator, StatusBar, Wallpaper } from './phone-frame';
import type { LockNotification, PreviewState } from './types';

/** Flow steps of the lock screen page (index = step shown as active). */
export const LOCK_FLOW = [
    'Notifikasi penting tampil di layar kunci, yang sejenis digabung',
    'Setujui cuti langsung dari notifikasi, dikonfirmasi Face ID',
    'Check-in sekarang: buka kunci lalu masuk ke check-in wajah',
    'Nanti: pengingat ditunda 10 menit',
    'Ketuk notifikasi lain untuk membukanya di aplikasi',
];

type CardState =
    | { kind: 'idle' }
    | { kind: 'auth' }
    | { kind: 'sending' }
    | { kind: 'approved' }
    | { kind: 'failed' };

const AUTH_MS = 900;

function AppGlyph() {
    return (
        <span
            aria-hidden
            className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-grad-merek text-[13px] font-extrabold"
        >
            RK
        </span>
    );
}

/** MLockScreen: notifications with actions on the phone's lock screen. */
export function LockScreen({
    state,
    onStepChange,
}: {
    state: PreviewState;
    onStepChange?: (step: number) => void;
}) {
    const [items, setItems] = useState<LockNotification[]>(
        state === 'kosong' ? [] : LOCK_NOTIFICATIONS,
    );
    const [cards, setCards] = useState<Record<string, CardState>>({});
    const [unlocking, setUnlocking] = useState(false);
    const timers = useRef<number[]>([]);
    const approve = useFakeMutation();

    useEffect(
        () => () => timers.current.forEach((t) => window.clearTimeout(t)),
        [],
    );

    const later = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(fn, ms));
    };

    const setCard = (id: string, card: CardState) =>
        setCards((current) => ({ ...current, [id]: card }));

    const open = (href: string | null | undefined, step = 4) => {
        onStepChange?.(step);
        setUnlocking(true);
        later(() => {
            setUnlocking(false);

            if (href) {
                router.visit(href);
            }
        }, AUTH_MS);
    };

    const onPrimary = (note: LockNotification) => {
        if (note.kind === 'check_in_reminder') {
            open(note.href, 2);

            return;
        }

        if (!note.needs_auth) {
            open(note.href);

            return;
        }

        onStepChange?.(1);
        setCard(note.id, { kind: 'auth' });
        later(() => {
            setCard(note.id, { kind: 'sending' });
            void approve
                .run(() => setCard(note.id, { kind: 'approved' }), {
                    fail: state === 'galat',
                    error: 'Persetujuan belum terkirim. Buka aplikasi untuk mencoba lagi.',
                    delay: 700,
                })
                .then((ok) => {
                    if (!ok) {
                        setCard(note.id, { kind: 'failed' });
                    }
                });
        }, AUTH_MS);
    };

    const onSecondary = (note: LockNotification) => {
        if (note.kind === 'check_in_reminder' || note.kind === 'meeting') {
            onStepChange?.(3);
            setItems((current) => current.filter((n) => n.id !== note.id));
            toast.success('Pengingat check-in ditunda 10 menit');

            return;
        }

        open(note.href);
    };

    const undo = (note: LockNotification) => {
        setCard(note.id, { kind: 'idle' });
        toast('Persetujuan cuti dibatalkan');
    };

    return (
        <Wallpaper kind="lock">
            <StatusBar time="07.52" />
            <div className="flex shrink-0 flex-col items-center pt-6 pb-4">
                <span className="text-[18px] font-bold">Senin, 5 Oktober</span>
                <span className="text-[84px] leading-[92px] font-bold tracking-[-0.03em] tnum">
                    07.52
                </span>
            </div>

            <div className="mb-[108px] flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
                {items.length > 0 && (
                    <div className="flex items-center justify-between px-2">
                        <span className="text-[15px] font-bold text-on-brand/85">
                            Pusat notifikasi
                        </span>
                        <button
                            type="button"
                            onClick={() => setItems([])}
                            className={cn(
                                'min-h-11 rounded-full px-3 text-[14px] font-bold text-on-brand/85 hover:bg-on-brand/12',
                                focusRing,
                            )}
                        >
                            Bersihkan
                        </button>
                    </div>
                )}

                {items.length === 0 && (
                    <div
                        role="status"
                        className="mt-16 flex flex-col items-center gap-2 text-center text-on-brand/80"
                    >
                        <BellOff aria-hidden className="size-7" />
                        <span className="text-[16px] font-bold">
                            Tidak ada notifikasi baru
                        </span>
                        <span className="max-w-[260px] text-[14px]">
                            Pengingat check-in dan persetujuan akan muncul di
                            sini.
                        </span>
                    </div>
                )}

                {items.map((note) => {
                    const card = cards[note.id] ?? { kind: 'idle' };

                    if (card.kind === 'approved') {
                        return (
                            <div
                                key={note.id}
                                role="status"
                                className="flex items-center gap-3 rounded-[24px] bg-on-brand/18 p-3.5 backdrop-blur-xl"
                            >
                                <CircleCheck
                                    aria-hidden
                                    className="size-6 shrink-0 text-brand-300"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-[15px] font-extrabold">
                                        Cuti Sari disetujui
                                    </span>
                                    <span className="text-[14px] text-on-brand/80">
                                        Diteruskan ke HR · Hana
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => undo(note)}
                                    className={cn(
                                        'min-h-11 rounded-full bg-on-brand/22 px-4 text-[15px] font-bold',
                                        focusRing,
                                    )}
                                >
                                    Urungkan
                                </button>
                            </div>
                        );
                    }

                    const busy =
                        card.kind === 'auth' || card.kind === 'sending';

                    return (
                        <article
                            key={note.id}
                            aria-label={note.title}
                            className="flex flex-col gap-2.5 rounded-[24px] bg-on-brand/18 p-3.5 backdrop-blur-xl"
                        >
                            <button
                                type="button"
                                onClick={() => open(note.href)}
                                aria-label={`Buka di aplikasi: ${note.title}. ${note.body}`}
                                className={cn(
                                    'flex gap-3 rounded-[14px] text-left',
                                    focusRing,
                                )}
                            >
                                <AppGlyph />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex justify-between gap-2">
                                        <span className="truncate text-[15px] font-extrabold">
                                            {note.title}
                                        </span>
                                        <span className="shrink-0 text-[13px] text-on-brand/85">
                                            {note.time}
                                        </span>
                                    </span>
                                    <span className="text-[15px] leading-[21px]">
                                        {note.body}
                                    </span>
                                </span>
                                {!note.primary && (
                                    <ChevronRight
                                        aria-hidden
                                        className="mt-2 size-5 shrink-0 text-on-brand/70"
                                    />
                                )}
                            </button>
                            {card.kind === 'failed' && (
                                <p
                                    role="alert"
                                    className="flex items-center gap-2 rounded-[12px] bg-preview-dark/40 px-3 py-2 text-[14px] font-semibold"
                                >
                                    <CircleAlert
                                        aria-hidden
                                        className="size-4 shrink-0"
                                    />
                                    Belum terkirim. Buka aplikasi untuk mencoba
                                    lagi.
                                </p>
                            )}
                            {note.primary && (
                                <span className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => onPrimary(note)}
                                        className={cn(
                                            'flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-on-brand text-[16px] font-extrabold text-brand-800 transition-transform duration-120 ease-brand active:scale-[0.98] disabled:opacity-80',
                                            focusRing,
                                        )}
                                    >
                                        {card.kind === 'auth' && (
                                            <ScanFace
                                                aria-hidden
                                                className="size-5"
                                            />
                                        )}
                                        {card.kind === 'auth'
                                            ? 'Face ID…'
                                            : card.kind === 'sending'
                                              ? 'Mengirim…'
                                              : card.kind === 'failed'
                                                ? 'Coba lagi'
                                                : note.primary}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => onSecondary(note)}
                                        className={cn(
                                            'h-[46px] rounded-[14px] bg-on-brand/22 text-[16px] font-bold transition-transform duration-120 ease-brand active:scale-[0.98]',
                                            focusRing,
                                        )}
                                    >
                                        {note.secondary}
                                    </button>
                                </span>
                            )}
                        </article>
                    );
                })}
            </div>

            {unlocking && (
                <div
                    role="status"
                    className="absolute inset-0 z-20 flex animate-in items-center justify-center bg-preview-dark/40 backdrop-blur-sm duration-180 ease-brand fade-in-0"
                >
                    <span className="flex size-40 flex-col items-center justify-center gap-3 rounded-[32px] bg-preview-dark/80 text-[15px] font-bold">
                        <ScanFace
                            aria-hidden
                            className="size-14 text-brand-300"
                            strokeWidth={1.6}
                        />
                        Membuka kunci…
                    </span>
                </div>
            )}

            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 bottom-11 flex justify-between"
            >
                <span className="flex size-[52px] items-center justify-center rounded-full bg-on-brand/18 backdrop-blur-xl">
                    <Flashlight className="size-[22px]" />
                </span>
                <span className="flex size-[52px] items-center justify-center rounded-full bg-on-brand/18 backdrop-blur-xl">
                    <Camera className="size-[22px]" />
                </span>
            </div>
            <HomeIndicator />
        </Wallpaper>
    );
}
