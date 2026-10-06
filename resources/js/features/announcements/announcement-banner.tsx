import { Link } from '@inertiajs/react';
import { Megaphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatRelative } from '@/lib/format';
import { requestJson } from '@/lib/http';
import { cn, focusRing } from '@/lib/utils';
import type { Announcement, AnnouncementBannerData } from './types';

/** Banner list after closing one (pure, for the optimistic update). */
export function withoutAnnouncement(
    data: AnnouncementBannerData,
    id: string,
): AnnouncementBannerData {
    const items = data.items.filter((item) => item.id !== id);

    return {
        items,
        total: Math.max(
            0,
            data.total - (items.length < data.items.length ? 1 : 0),
        ),
    };
}

function BannerItem({
    item,
    onClose,
}: {
    item: Announcement;
    onClose: () => void;
}) {
    return (
        <li className="flex items-start gap-3 rounded-card border border-info/25 bg-info-soft px-4 py-3 md:px-5">
            <span
                aria-hidden
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface text-info"
            >
                <Megaphone className="size-[18px]" strokeWidth={2} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-[16px] leading-6 font-bold break-words text-text">
                    {item.title}
                </p>
                <p className="line-clamp-2 text-[15px] leading-[22px] break-words whitespace-pre-line text-text">
                    {item.body}
                </p>
                <p className="text-meta text-text-muted">
                    {[
                        item.author?.name,
                        item.audience_label,
                        formatRelative(item.published_at),
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label={`Tutup pengumuman ${item.title}`}
                className={cn(
                    '-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-[12px] text-text-muted hover:bg-surface/70',
                    focusRing,
                )}
            >
                <X className="size-5" aria-hidden />
            </button>
        </li>
    );
}

/**
 * Pengumuman above every dashboard (keputusan pemilik 6 Okt 2026): latest 3
 * active announcements addressed to me and not closed, loaded apart from the
 * dashboard (GET /pengumuman/spanduk) so it never slows it down. "×" closes it
 * on my dashboards only; the Inbox notification stays.
 */
export function AnnouncementBanner({ className }: { className?: string }) {
    const [data, setData] = useState<AnnouncementBannerData | null>(null);

    useEffect(() => {
        const abort = new AbortController();

        requestJson<AnnouncementBannerData>('/pengumuman/spanduk', {
            signal: abort.signal,
        })
            .then(setData)
            // A banner is optional: on failure the dashboard simply shows none.
            .catch(() => undefined);

        return () => abort.abort();
    }, []);

    if (!data || data.items.length === 0) {
        return null;
    }

    const close = (item: Announcement) => {
        const before = data;
        setData(withoutAnnouncement(data, item.id));

        requestJson<null>(`/pengumuman/${item.id}/tutup`, {
            method: 'POST',
        }).catch(() => {
            setData(before);
            toast.error('Pengumuman gagal ditutup. Coba lagi.');
        });
    };

    return (
        <section
            aria-label="Pengumuman"
            className={cn('flex flex-col gap-2', className)}
        >
            <ul className="flex flex-col gap-2">
                {data.items.map((item) => (
                    <BannerItem
                        key={item.id}
                        item={item}
                        onClose={() => close(item)}
                    />
                ))}
            </ul>
            {data.total > data.items.length && (
                <Link
                    href="/pengumuman"
                    className={cn(
                        'inline-flex min-h-11 items-center self-start rounded-control px-1 text-[15px] font-semibold text-link hover:underline',
                        focusRing,
                    )}
                >
                    Lihat semua pengumuman ({data.total})
                </Link>
            )}
        </section>
    );
}
