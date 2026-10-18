import { useStartAudio } from '@livekit/components-react';
import type { Room as LiveRoom } from 'livekit-client';
import { Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Full-screen message on the desk: connecting, left, removed, errors. */
export function RoomMessage({
    icon,
    title,
    body,
    children,
}: {
    icon: ReactNode;
    title: string;
    body?: string;
    children?: ReactNode;
}) {
    return (
        <div
            role="status"
            className="flex min-h-0 flex-1 items-center justify-center px-4"
        >
            <div className="flex w-full max-w-[560px] flex-col items-center gap-5 rounded-panel bg-surface px-6 py-10 text-center shadow-card md:px-10">
                <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-muted [&_svg]:size-7">
                    {icon}
                </span>
                <span className="flex flex-col gap-2">
                    <span className="text-[24px] leading-8 font-extrabold">
                        {title}
                    </span>
                    {body && (
                        <span className="text-[16px] leading-6 text-text-muted">
                            {body}
                        </span>
                    )}
                </span>
                {children && (
                    <span className="flex flex-wrap justify-center gap-3">
                        {children}
                    </span>
                )}
            </div>
        </div>
    );
}

/** Banner when the browser blocked autoplay (opened /ruang directly). */
export function StartAudioBanner({ room }: { room: LiveRoom }) {
    const { mergedProps, canPlayAudio } = useStartAudio({ room, props: {} });

    if (canPlayAudio) {
        return null;
    }

    return (
        <div className="absolute inset-x-0 top-3 z-30 flex justify-center px-3">
            <Button size="lg" onClick={mergedProps.onClick}>
                <Volume2 aria-hidden />
                Aktifkan suara rapat
            </Button>
        </div>
    );
}
