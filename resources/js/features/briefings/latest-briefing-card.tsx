import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { latestBriefing, latestBriefingTitle } from './briefing-state';
import type { BriefingCardData, LatestBriefingData } from './types';

/** What the card shows, from either payload. */
type LatestNote = { title: string; content: string; recordedBy: string };

/**
 * Kartu kecil "Briefing terakhir" (keputusan pemilik 9 Okt 2026) for every
 * viewer of the dashboard: the newest note of the company with a 3-line
 * snippet; tapping it opens the full minutes in a read-only dialog. Reads
 * the `latestBriefing` prop sent to every viewer; `briefing` (recorder
 * card payload, null for regular employees) is only a fallback while the
 * server does not send it. Renders null while no briefing exists yet.
 */
export function LatestBriefingCard({
    latest,
    briefing,
    variant = 'desktop',
}: {
    latest?: LatestBriefingData | null;
    briefing?: BriefingCardData | null;
    variant?: 'desktop' | 'mobile';
}) {
    let note: LatestNote | null = null;

    if (latest !== undefined) {
        note =
            latest === null
                ? null
                : {
                      title: latestBriefingTitle(latest),
                      content: latest.content,
                      recordedBy: latest.oleh,
                  };
    } else if (briefing) {
        const saved = latestBriefing(briefing);
        note = saved
            ? {
                  title: saved.title,
                  content: saved.content,
                  recordedBy: saved.saved_by.name,
              }
            : null;
    }

    if (note === null) {
        return null;
    }

    return <LatestCard note={note} variant={variant} />;
}

function LatestCard({
    note,
    variant,
}: {
    note: LatestNote;
    variant: 'desktop' | 'mobile';
}) {
    const [open, setOpen] = useState(false);
    const byline = `Dicatat oleh ${note.recordedBy}`;

    const reader =
        variant === 'mobile' ? (
            <BottomSheet
                open={open}
                onOpenChange={setOpen}
                title={note.title}
                description={byline}
                footer={
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={() => setOpen(false)}
                    >
                        Tutup
                    </Button>
                }
            >
                <p className="text-[16px] leading-7 whitespace-pre-wrap text-text">
                    {note.content}
                </p>
            </BottomSheet>
        ) : (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{note.title}</DialogTitle>
                        <DialogDescription>{byline}</DialogDescription>
                    </DialogHeader>
                    <p className="max-h-[60svh] overflow-y-auto text-[16px] leading-7 whitespace-pre-wrap text-text">
                        {note.content}
                    </p>
                </DialogContent>
            </Dialog>
        );

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Baca isi briefing: ${note.title}`}
                className="group flex w-full flex-col rounded-card border border-border bg-surface p-5 text-left shadow-card transition-colors duration-120 ease-brand outline-none hover:bg-surface-2/60 focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span className="flex items-baseline justify-between gap-3">
                    <span className="text-overline text-text-muted">
                        Briefing terakhir
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[15px] font-semibold text-link">
                        Baca
                        <ChevronRight
                            aria-hidden
                            className="size-4 transition-transform duration-120 ease-brand group-hover:translate-x-0.5"
                        />
                    </span>
                </span>
                <span className="mt-1 text-[17px] leading-[24px] font-bold text-text">
                    {note.title}
                </span>
                <span className="mt-1.5 line-clamp-3 text-[15px] leading-[22px] whitespace-pre-line text-text-muted">
                    {note.content}
                </span>
                <span className="mt-2 text-[14px] text-text-subtle">
                    {byline}
                </span>
            </button>
            {reader}
        </>
    );
}
