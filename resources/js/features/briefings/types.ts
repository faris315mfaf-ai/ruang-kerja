/**
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026): the dashboard card
 * payload as sent by App\Domain\Briefings\Queries\BriefingWindow — null for
 * employees who are neither HR / Super Admin nor an appointed delegate today
 * (the briefing arrives in their Inbox instead).
 */

export type BriefingPeriodValue = 'pagi' | 'sore';

export type BriefingPeriodStatus = 'before' | 'open' | 'after';

/** One window of the day: pagi 08.00–11.00, sore 16.00–18.00 office time. */
export type BriefingPeriodInfo = {
    value: BriefingPeriodValue;
    label: string;
    starts_at: string;
    ends_at: string;
    status: BriefingPeriodStatus;
};

export type BriefingPersonRef = {
    id: string;
    name: string;
};

/** Today's appointment of one period: who records, appointed by whom. */
export type BriefingDelegation = {
    to: BriefingPersonRef;
    by: BriefingPersonRef;
};

/** One saved note ("Briefing pagi 9 Oktober 2026"). */
export type BriefingNote = {
    id: string;
    /** "YYYY-MM-DD" (office calendar). */
    date: string;
    period: BriefingPeriodValue;
    title: string;
    content: string;
    saved_by: BriefingPersonRef;
    delegated_from: { id: string | null; name: string | null } | null;
    saved_at: string | null;
};

export type BriefingCardData = {
    date: string;
    date_label: string;
    /** HR / Super Admin (may also delegate). */
    is_recorder: boolean;
    current: BriefingPeriodValue | null;
    /** True inside the open window for someone who may record it. */
    can_record: boolean;
    periods: BriefingPeriodInfo[];
    delegations: Partial<Record<BriefingPeriodValue, BriefingDelegation>>;
    /** Today's note per period (null while unsent). */
    saved: Partial<Record<BriefingPeriodValue, BriefingNote | null>>;
    /** Latest note per period that has none today. */
    latest: Partial<Record<BriefingPeriodValue, BriefingNote | null>>;
    urls: { store: string; delegate: string };
};
