/**
 * "Waktu bicara" (pure, tested in talk-time.test.ts). Every browser in the
 * room counts speaking time from LiveKit's active-speaker events: between two
 * events, everyone in the previous speaker set gets the elapsed time. Totals
 * are milliseconds per participant identity (= user id). Several browsers
 * observe the same meeting, so the persisted value per person is the largest
 * one reported (see contract.ts › saveTalkTime).
 */

export type TalkTotals = Record<string, number>;

export type TalkState = {
    totals: TalkTotals;
    /** Who is speaking since `since` (ms). */
    speaking: string[];
    since: number;
};

/** Ignore gaps longer than this (tab asleep, clock jump). */
const MAX_STEP_MS = 10_000;

export function startTalk(now: number, totals: TalkTotals = {}): TalkState {
    return { totals: { ...totals }, speaking: [], since: now };
}

/** Credits the time since the last event, then sets the new speaker set. */
export function recordSpeakers(
    state: TalkState,
    speaking: string[],
    now: number,
): TalkState {
    const step = Math.min(Math.max(0, now - state.since), MAX_STEP_MS);
    const totals = { ...state.totals };

    for (const identity of state.speaking) {
        totals[identity] = (totals[identity] ?? 0) + step;
    }

    return { totals, speaking: [...new Set(speaking)], since: now };
}

/** Totals including the running stretch (for display), without mutating. */
export function totalsAt(state: TalkState, now: number): TalkTotals {
    return recordSpeakers(state, state.speaking, now).totals;
}

/** Largest value per person of two sources (server + this browser). */
export function mergeTotals(a: TalkTotals, b: TalkTotals): TalkTotals {
    const merged: TalkTotals = { ...a };

    for (const [identity, ms] of Object.entries(b)) {
        merged[identity] = Math.max(merged[identity] ?? 0, ms);
    }

    return merged;
}

export type TalkRow = {
    id: string;
    ms: number;
    /** Share of all speaking time, 0–1. */
    share: number;
    /** Bar length relative to the top speaker, 0–1. */
    relative: number;
    /** Talks much more than an even share (amber bar in the mockup). */
    dominant: boolean;
};

/**
 * Rows for every person (`ids`: who is or was in the room), most speaking
 * first; people who did not speak stay at the bottom with 0.
 */
export function talkRows(totals: TalkTotals, ids: string[]): TalkRow[] {
    const all = [...new Set([...ids, ...Object.keys(totals)])];
    const sum = all.reduce((total, id) => total + (totals[id] ?? 0), 0);
    const top = Math.max(0, ...all.map((id) => totals[id] ?? 0));
    const even = all.length > 0 ? 1 / all.length : 1;

    return all
        .map((id) => {
            const ms = totals[id] ?? 0;
            const share = sum > 0 ? ms / sum : 0;

            return {
                id,
                ms,
                share,
                relative: top > 0 ? ms / top : 0,
                dominant: all.length > 2 && share >= Math.max(0.35, even * 2),
            };
        })
        .sort((a, b) => b.ms - a.ms);
}

/** "7,2′" — minutes with one decimal (mockup). */
export function talkMinutes(ms: number): string {
    return `${(Math.floor(ms / 6000) / 10).toFixed(1).replace('.', ',')}′`;
}

/**
 * "Dimas bicara 40% waktu rapat. Yoga belum bicara." / "Yoga dan Bayu belum
 * bicara." Null while nobody has spoken.
 */
export function talkSummary(
    rows: TalkRow[],
    nameOf: (id: string) => string,
): string | null {
    const top = rows[0];

    if (!top || top.ms === 0) {
        return null;
    }

    const parts = [
        `${nameOf(top.id)} bicara ${Math.round(top.share * 100)}% waktu rapat.`,
    ];
    const silent = rows.filter((row) => row.ms < 1000).map((row) => row.id);

    if (silent.length === 1) {
        parts.push(`${nameOf(silent[0])} belum bicara.`);
    } else if (silent.length === 2) {
        parts.push(
            `${nameOf(silent[0])} dan ${nameOf(silent[1])} belum bicara.`,
        );
    } else if (silent.length > 2) {
        parts.push(`${silent.length} orang belum bicara.`);
    }

    return parts.join(' ');
}
