import { Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoomNotices } from './room-notices';

/** Short notices over the stage ("Rizky bergabung", errors); see room-notices. */
export function Notices() {
    const notices = useRoomNotices();

    return (
        <ul
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 px-3"
        >
            {notices.map((notice) => (
                <li
                    key={notice.id}
                    className={cn(
                        'inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold shadow-inverse',
                        notice.tone === 'error'
                            ? 'bg-danger text-on-danger'
                            : 'bg-room-bar text-on-room-bar',
                    )}
                >
                    {notice.tone === 'hand' && (
                        <Hand aria-hidden className="size-4" />
                    )}
                    {notice.text}
                </li>
            ))}
        </ul>
    );
}
