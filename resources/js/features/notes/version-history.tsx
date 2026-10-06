import { History, RotateCcw, X } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { clockTime, dayLabel, prototypeNow } from '@/features/chat/lib';
import { RichTextView } from '@/features/tasks/editor/rich-text-view';
import { formatDateTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { wordCount } from './lib';
import { NOTE_PROSE_VIEW } from './note-editor';
import type { NotePerson, NoteVersion } from './types';

function personName(people: NotePerson[], id: string): string {
    return people.find((person) => person.id === id)?.name ?? 'Pengguna';
}

/** "Hari ini 10.12", "Kemarin 16.02", "Jumat, 2 Oktober 14.25". */
export function versionTime(value: string): string {
    return `${dayLabel(value, prototypeNow())} ${clockTime(value)}`;
}

/** Versions newest first; the newest is "Versi saat ini". */
export function VersionList({
    versions,
    people,
    selectedId,
    onSelect,
    mobile = false,
}: {
    versions: NoteVersion[];
    people: NotePerson[];
    selectedId: string | null;
    onSelect: (version: NoteVersion) => void;
    mobile?: boolean;
}) {
    const sorted = [...versions].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
    );

    if (sorted.length === 0) {
        return (
            <p className="py-6 text-center text-[15px] text-text-muted">
                Belum ada versi tersimpan.
            </p>
        );
    }

    return (
        <ol aria-label="Riwayat versi" className="flex flex-col gap-1">
            {sorted.map((version, index) => {
                const name = personName(people, version.created_by);
                const selected = version.id === selectedId;

                return (
                    <li key={version.id}>
                        <button
                            type="button"
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => onSelect(version)}
                            className={cn(
                                'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-120 ease-brand',
                                mobile ? 'min-h-16' : 'min-h-14',
                                selected
                                    ? 'bg-link-soft'
                                    : 'hover:bg-surface-2',
                                focusRing,
                            )}
                        >
                            <UserAvatar
                                name={name}
                                className="mt-0.5 size-8 text-[12px]"
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex flex-wrap items-center gap-2">
                                    <time
                                        dateTime={version.created_at}
                                        title={formatDateTime(
                                            version.created_at,
                                        )}
                                        className="text-[15px] font-semibold text-text"
                                    >
                                        {versionTime(version.created_at)}
                                    </time>
                                    {index === 0 && (
                                        <Badge
                                            variant="status"
                                            tone="link"
                                            className="h-6 px-2 text-[13px]"
                                        >
                                            Versi saat ini
                                        </Badge>
                                    )}
                                </span>
                                <span className="truncate text-[14px] text-text-muted">
                                    {version.label ?? name} ·{' '}
                                    {wordCount(version.content)} kata
                                </span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

/** Read-only view of an older version with "Pulihkan versi ini". */
export function VersionPreview({
    version,
    people,
    isCurrent,
    onRestore,
    onClose,
    className,
}: {
    version: NoteVersion;
    people: NotePerson[];
    isCurrent: boolean;
    onRestore?: () => void;
    onClose?: () => void;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-info-soft px-4 py-3 text-info">
                <History className="size-5 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 text-[15px] leading-[22px] font-semibold">
                    {isCurrent ? 'Versi saat ini' : 'Melihat versi'} ·{' '}
                    {versionTime(version.created_at)} oleh{' '}
                    {personName(people, version.created_by)}
                </p>
                {!isCurrent && onRestore && (
                    <Button size="sm" onClick={onRestore}>
                        <RotateCcw aria-hidden />
                        Pulihkan versi ini
                    </Button>
                )}
                {onClose && (
                    <Button size="sm" variant="outline" onClick={onClose}>
                        <X aria-hidden />
                        Tutup pratinjau
                    </Button>
                )}
            </div>
            <h2 className="text-h2 break-words text-text">{version.title}</h2>
            <RichTextView
                doc={version.content}
                className={cn('text-[17px] leading-7', NOTE_PROSE_VIEW)}
                empty={
                    <p className="text-[15px] text-text-muted">
                        Versi ini kosong.
                    </p>
                }
            />
        </div>
    );
}

export function RestoreVersionDialog({
    version,
    processing,
    onOpenChange,
    onConfirm,
}: {
    version: NoteVersion | null;
    processing: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) {
    return (
        <Dialog open={version !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pulihkan versi ini?</DialogTitle>
                    <DialogDescription>
                        Isi catatan diganti dengan versi{' '}
                        {version ? versionTime(version.created_at) : ''}. Versi
                        sekarang tetap ada di riwayat, dan semua penyunting
                        melihat perubahannya langsung.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="quiet" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    <Button onClick={onConfirm} disabled={processing}>
                        {processing ? <Spinner /> : <RotateCcw aria-hidden />}
                        Pulihkan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
