import { useEffect, useState } from 'react';

/**
 * Short notices shown over the video stage ("Rizky bergabung", "Izin kamera
 * ditolak …"). Sonner toasts would cover the control bar, so the room has
 * its own small queue: anything in the room emits, ConnectedRoom renders.
 */
export type RoomNotice = {
    id: number;
    text: string;
    tone: 'info' | 'hand' | 'error';
};

const bus = new EventTarget();
let sequence = 0;

export function emitRoomNotice(
    text: string,
    tone: RoomNotice['tone'] = 'info',
): void {
    sequence += 1;
    bus.dispatchEvent(
        new CustomEvent<RoomNotice>('notice', {
            detail: { id: sequence, text, tone },
        }),
    );
}

/** The last three notices; each disappears after 4 s (errors 7 s). */
export function useRoomNotices(): RoomNotice[] {
    const [notices, setNotices] = useState<RoomNotice[]>([]);

    useEffect(() => {
        const timers: number[] = [];
        const onNotice = (event: Event) => {
            const notice = (event as CustomEvent<RoomNotice>).detail;
            setNotices((list) => [...list.slice(-2), notice]);
            timers.push(
                window.setTimeout(
                    () =>
                        setNotices((list) =>
                            list.filter((item) => item.id !== notice.id),
                        ),
                    notice.tone === 'error' ? 7000 : 4000,
                ),
            );
        };

        bus.addEventListener('notice', onNotice);

        return () => {
            bus.removeEventListener('notice', onNotice);
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, []);

    return notices;
}
