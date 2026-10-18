import { Head, router } from '@inertiajs/react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { CreateAnnouncement } from '@/features/announcements/create-announcement';
import type {
    Announcement,
    AnnouncementOptions,
} from '@/features/announcements/types';
import { ConfirmDialog } from '@/features/requests/confirm-dialog';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate, formatDateTime, officeTimezone } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
    received: Announcement[];
    mine: Announcement[];
    selected: string | null;
    can_create: boolean;
    options: AnnouncementOptions | null;
};

function officeToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: officeTimezone(),
    }).format(new Date());
}

function AnnouncementCard({
    item,
    highlighted,
    onDelete,
}: {
    item: Announcement;
    highlighted: boolean;
    onDelete: (item: Announcement) => void;
}) {
    return (
        <li
            id={`pengumuman-${item.id}`}
            className={cn(
                'flex flex-col gap-2 px-5 py-4 md:px-6',
                highlighted && 'bg-link-soft',
            )}
        >
            <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="text-title font-bold break-words text-text">
                        {item.title}
                    </h3>
                    <p className="text-meta text-text-muted">
                        {[
                            item.author?.name,
                            item.audience_label,
                            formatDateTime(item.published_at),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                {item.can_delete && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus pengumuman ${item.title}`}
                        onClick={() => onDelete(item)}
                    >
                        <Trash2 aria-hidden />
                    </Button>
                )}
            </div>
            <p className="text-[16px] leading-6 break-words whitespace-pre-line text-text">
                {item.body}
            </p>
            <div className="flex flex-wrap gap-2">
                {!item.active && (
                    <Badge variant="status" tone="neutral" dot>
                        Sudah berakhir
                    </Badge>
                )}
                {item.active && item.expires_at && (
                    <Badge variant="status" tone="info" dot>
                        Tampil s.d. {formatDate(item.expires_at)}
                    </Badge>
                )}
                {item.dismissed && (
                    <Badge variant="status" tone="neutral">
                        Ditutup dari dashboard
                    </Badge>
                )}
            </div>
        </li>
    );
}

function List({
    title,
    items,
    empty,
    selected,
    onDelete,
}: {
    title: string;
    items: Announcement[];
    empty: string;
    selected: string | null;
    onDelete: (item: Announcement) => void;
}) {
    return (
        <Panel title={title} flush className="min-w-0 flex-[1_1_420px]">
            {items.length === 0 ? (
                <div className="px-5 pb-1 md:px-6">
                    <EmptyState size="sm" icon={Megaphone} title={empty} />
                </div>
            ) : (
                <ul className="divide-y divide-divider border-t border-divider">
                    {items.map((item) => (
                        <AnnouncementCard
                            key={item.id}
                            item={item}
                            highlighted={item.id === selected}
                            onDelete={onDelete}
                        />
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/**
 * /pengumuman (keputusan pemilik 6 Okt 2026): announcements I received and
 * the ones I wrote; Direksi, HR, Super Admin, Kepala Divisi and Ketua Tim
 * publish new ones.
 */
export default function AnnouncementsIndex({
    received,
    mine,
    selected,
    can_create,
    options,
}: Props) {
    const mobile = useBreakpoint() === 'mobile';
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<Announcement | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (selected) {
            document
                .getElementById(`pengumuman-${selected}`)
                ?.scrollIntoView({ block: 'center' });
        }
    }, [selected]);

    const remove = () => {
        if (!deleting) {
            return;
        }

        setProcessing(true);
        router.delete(`/pengumuman/${deleting.id}`, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                setDeleting(null);
            },
        });
    };

    return (
        <>
            <Head title="Pengumuman" />
            <div className="flex flex-col gap-5 md:gap-6">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-display text-text max-md:sr-only">
                            Pengumuman
                        </h1>
                        <p className="text-body text-text-muted md:text-body-lg">
                            Pengumuman terbaru tampil di atas dashboard sampai
                            Anda menutupnya.
                        </p>
                    </div>
                    {can_create && !mobile && (
                        <Button onClick={() => setCreating(true)}>
                            <Plus aria-hidden strokeWidth={2.4} />
                            Pengumuman baru
                        </Button>
                    )}
                </header>

                <div className="flex flex-wrap items-start gap-5">
                    <List
                        title="Untuk saya"
                        items={received}
                        empty="Belum ada pengumuman untuk Anda."
                        selected={selected}
                        onDelete={setDeleting}
                    />
                    {(can_create || mine.length > 0) && (
                        <List
                            title="Saya buat"
                            items={mine}
                            empty="Anda belum membuat pengumuman."
                            selected={selected}
                            onDelete={setDeleting}
                        />
                    )}
                </div>
            </div>

            {can_create && mobile && (
                <Fab
                    label="Pengumuman baru"
                    onClick={() => setCreating(true)}
                />
            )}
            {can_create && options && (
                <CreateAnnouncement
                    open={creating}
                    onOpenChange={setCreating}
                    options={options}
                    mobile={mobile}
                    today={officeToday()}
                />
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Hapus pengumuman?"
                description="Pengumuman hilang dari semua dashboard. Notifikasi yang sudah terkirim tetap ada di Inbox penerima."
                confirmLabel="Hapus"
                destructive
                processing={processing}
                onConfirm={remove}
            />
        </>
    );
}

AnnouncementsIndex.layout = {
    breadcrumbs: [{ title: 'Pengumuman', href: '/pengumuman' }],
    title: 'Pengumuman',
    back: '/menu',
};
