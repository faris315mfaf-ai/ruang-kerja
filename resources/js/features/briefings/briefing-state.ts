import type { SearchResult } from '@/features/search/types';
import type {
    BriefingCardData,
    BriefingPeriodInfo,
    BriefingPeriodValue,
    BriefingNote,
    LatestBriefingData,
} from './types';

/** Mirrors SaveBriefingRequest's max length. */
export const MAX_CONTENT = 10_000;

/** Sore comes after pagi on the same office date. */
const PERIOD_ORDER: Record<BriefingPeriodValue, number> = { pagi: 0, sore: 1 };

/** "Pagi" / "Sore" for segmented picks (BriefingPeriod::label is longer). */
export function shortPeriodLabel(value: BriefingPeriodValue): string {
    return value === 'pagi' ? 'Pagi' : 'Sore';
}

/** "08.00–11.00" — the recording window of one period, Indonesian digits. */
export function windowLabel(period: BriefingPeriodInfo): string {
    return `${period.starts_at.replace(':', '.')}–${period.ends_at.replace(':', '.')}`;
}

/** The period whose window is open now, if any. */
export function openPeriod(
    briefing: BriefingCardData,
): BriefingPeriodInfo | null {
    return briefing.periods.find((period) => period.status === 'open') ?? null;
}

/**
 * The "Catat briefing" card only exists for someone who may record the open
 * period (HR / Super Admin / appointed delegate) while a window is open.
 */
export function shouldShowRecorderCard(
    briefing: BriefingCardData | null | undefined,
): boolean {
    return (
        briefing !== null &&
        briefing !== undefined &&
        briefing.can_record &&
        openPeriod(briefing) !== null
    );
}

/**
 * Periods an HR / Super Admin may still hand over: not finished and without
 * today's note (delegating a sent period has nothing left to record).
 */
export function delegatablePeriods(
    briefing: BriefingCardData,
): BriefingPeriodInfo[] {
    if (!briefing.is_recorder) {
        return [];
    }

    return briefing.periods.filter(
        (period) =>
            period.status !== 'after' &&
            (briefing.saved?.[period.value] ?? null) === null,
    );
}

/**
 * Sort key of a note: its office date, then sore after pagi on the same day.
 */
function noteRank(note: BriefingNote): [string, number] {
    return [note.date, PERIOD_ORDER[note.period]];
}

/**
 * The most recent note on screen: today's saved one wins, otherwise the
 * latest leftover per period ("Briefing terakhir" card for everyone).
 */
export function latestBriefing(
    briefing: BriefingCardData,
): BriefingNote | null {
    const notes = [
        ...Object.values(briefing.saved ?? {}),
        ...Object.values(briefing.latest ?? {}),
    ].filter(
        (note): note is BriefingNote => note !== null && note !== undefined,
    );

    return notes.reduce<BriefingNote | null>(
        (best, note) =>
            best === null || noteRank(note) > noteRank(best) ? note : best,
        null,
    );
}

const DAY_MONTH_YEAR = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

/**
 * Title of a note from the `latestBriefing` payload, same as the server's
 * Briefing::title(): "Briefing pagi 9 Oktober 2026" (pure date, no zone shift).
 */
export function latestBriefingTitle(latest: LatestBriefingData): string {
    const date = new Date(`${latest.date}T00:00:00Z`);

    return Number.isNaN(date.getTime())
        ? latest.label
        : `${latest.label} ${DAY_MONTH_YEAR.format(date)}`;
}

/** Client mirror of SaveBriefingRequest's content rules. */
export function contentError(content: string): string | null {
    if (content.trim() === '') {
        return 'Tulis notulensi briefing dulu.';
    }

    if (content.length > MAX_CONTENT) {
        return `Notulensi maksimal ${MAX_CONTENT} karakter.`;
    }

    return null;
}

/** A delegation may only be sent with a period and a chosen employee. */
export function delegateSelectionError(
    period: BriefingPeriodValue | null,
    candidateId: string | null,
): string | null {
    if (period === null) {
        return 'Pilih periode briefing.';
    }

    if (candidateId === null) {
        return 'Pilih karyawan yang akan mencatat.';
    }

    return null;
}

/** Candidate for the delegation picker, from a "people" search hit. */
export type DelegateCandidate = {
    id: string;
    name: string;
    /** "Jabatan · Divisi" (falls back to the email). */
    note: string | null;
    avatar: string | null;
};

/** Maps `/cari/hasil` "Orang" hits to picker candidates; other ids are null. */
export function candidateFromResult(
    result: SearchResult,
): DelegateCandidate | null {
    if (!result.id.startsWith('user:')) {
        return null;
    }

    return {
        id: result.id.slice('user:'.length),
        name: result.title,
        note: result.meta ?? result.subtitle,
        avatar: result.avatar,
    };
}
