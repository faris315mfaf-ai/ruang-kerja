import { describe, expect, it } from 'vite-plus/test';
import type { SearchResult } from '@/features/search/types';
import {
    candidateFromResult,
    contentError,
    delegateSelectionError,
    delegatablePeriods,
    latestBriefing,
    MAX_CONTENT,
    openPeriod,
    shortPeriodLabel,
    shouldShowRecorderCard,
    windowLabel,
} from './briefing-state';
import type {
    BriefingCardData,
    BriefingNote,
    BriefingPeriodInfo,
    BriefingPeriodStatus,
    BriefingPeriodValue,
} from './types';

function period(
    value: BriefingPeriodValue,
    status: BriefingPeriodStatus,
): BriefingPeriodInfo {
    return {
        value,
        label: value === 'pagi' ? 'Briefing pagi' : 'Briefing sore',
        starts_at: value === 'pagi' ? '08:00' : '16:00',
        ends_at: value === 'pagi' ? '11:00' : '18:00',
        status,
    };
}

function note(
    date: string,
    periodValue: BriefingPeriodValue,
    content = 'Poin pertama',
): BriefingNote {
    return {
        id: `${date}-${periodValue}`,
        date,
        period: periodValue,
        title: `Briefing ${periodValue} ${date}`,
        content,
        saved_by: { id: 'hr1', name: 'HR' },
        delegated_from: null,
        saved_at: null,
    };
}

function card(over: Partial<BriefingCardData> = {}): BriefingCardData {
    return {
        date: '2026-10-09',
        date_label: 'Jumat, 9 Oktober 2026',
        is_recorder: true,
        current: 'pagi',
        can_record: true,
        periods: [period('pagi', 'open'), period('sore', 'before')],
        delegations: {},
        saved: { pagi: null, sore: null },
        latest: { pagi: null, sore: null },
        urls: { store: '/briefing', delegate: '/briefing/delegasi' },
        ...over,
    };
}

describe('shouldShowRecorderCard', () => {
    it('is false without briefing props or recording rights', () => {
        expect(shouldShowRecorderCard(null)).toBe(false);
        expect(shouldShowRecorderCard(undefined)).toBe(false);
        expect(shouldShowRecorderCard(card({ can_record: false }))).toBe(false);
    });

    it('is false for a recorder outside both windows', () => {
        expect(
            shouldShowRecorderCard(
                card({
                    can_record: false,
                    current: null,
                    periods: [
                        period('pagi', 'after'),
                        period('sore', 'before'),
                    ],
                }),
            ),
        ).toBe(false);
    });

    it('is true for someone who may record the open period', () => {
        expect(shouldShowRecorderCard(card())).toBe(true);
        expect(
            shouldShowRecorderCard(
                card({ is_recorder: false, can_record: true }),
            ),
        ).toBe(true);
    });
});

describe('openPeriod', () => {
    it('finds the open window', () => {
        expect(openPeriod(card())?.value).toBe('pagi');
        expect(
            openPeriod(
                card({
                    current: 'sore',
                    periods: [period('pagi', 'after'), period('sore', 'open')],
                }),
            )?.value,
        ).toBe('sore');
    });

    it('returns null outside both windows', () => {
        expect(
            openPeriod(
                card({
                    current: null,
                    periods: [period('pagi', 'after'), period('sore', 'after')],
                }),
            ),
        ).toBeNull();
    });
});

describe('delegatablePeriods', () => {
    it('is empty for a delegate (only HR / Super Admin delegate)', () => {
        expect(delegatablePeriods(card({ is_recorder: false }))).toEqual([]);
    });

    it('offers unfinished periods without a note today', () => {
        expect(delegatablePeriods(card()).map((item) => item.value)).toEqual([
            'pagi',
            'sore',
        ]);
        expect(
            delegatablePeriods(
                card({
                    periods: [period('pagi', 'open'), period('sore', 'after')],
                }),
            ).map((item) => item.value),
        ).toEqual(['pagi']);
    });

    it("skips a period that already has today's note", () => {
        expect(
            delegatablePeriods(
                card({
                    saved: { pagi: note('2026-10-09', 'pagi'), sore: null },
                }),
            ).map((item) => item.value),
        ).toEqual(['sore']);
    });
});

describe('latestBriefing', () => {
    it('is null before any briefing exists', () => {
        expect(latestBriefing(card())).toBeNull();
    });

    it("prefers today's saved note over an older leftover", () => {
        const today = note('2026-10-09', 'pagi', 'Hari ini');
        const yesterday = note('2026-10-08', 'sore', 'Kemarin sore');

        expect(
            latestBriefing(
                card({
                    saved: { pagi: today, sore: null },
                    latest: { sore: yesterday },
                }),
            ),
        ).toBe(today);
    });

    it('breaks a same-day tie by period (sore after pagi)', () => {
        const pagi = note('2026-10-08', 'pagi');
        const sore = note('2026-10-08', 'sore');

        expect(latestBriefing(card({ latest: { pagi, sore } }))).toBe(sore);
    });

    it('picks the newest date among leftovers', () => {
        const older = note('2026-10-01', 'sore');
        const newer = note('2026-10-07', 'pagi');

        expect(
            latestBriefing(card({ latest: { pagi: newer, sore: older } })),
        ).toBe(newer);
    });
});

describe('contentError', () => {
    it('rejects empty or whitespace-only notes', () => {
        expect(contentError('')).not.toBeNull();
        expect(contentError('  \n\t ')).not.toBeNull();
        expect(contentError('Absen semua hadir')).toBeNull();
    });

    it('mirrors the server maximum length', () => {
        expect(contentError('a'.repeat(MAX_CONTENT))).toBeNull();
        expect(contentError('a'.repeat(MAX_CONTENT + 1))).not.toBeNull();
    });
});

describe('delegateSelectionError', () => {
    it('requires a period and a chosen employee', () => {
        expect(delegateSelectionError(null, null)).toBe(
            'Pilih periode briefing.',
        );
        expect(delegateSelectionError('pagi', null)).toBe(
            'Pilih karyawan yang akan mencatat.',
        );
        expect(delegateSelectionError('sore', '01H')).toBeNull();
    });
});

describe('candidateFromResult', () => {
    const hit = (over: Partial<SearchResult>): SearchResult => ({
        id: 'user:01H',
        title: 'Maya Lestari',
        icon: 'user',
        url: null,
        action: null,
        code: null,
        subtitle: 'maya@demo.test',
        meta: null,
        shortcut: null,
        snippet: null,
        avatar: null,
        external: false,
        ...over,
    });

    it('maps a people hit to a candidate', () => {
        expect(candidateFromResult(hit({}))).toEqual({
            id: '01H',
            name: 'Maya Lestari',
            note: 'maya@demo.test',
            avatar: null,
        });
        expect(
            candidateFromResult(
                hit({ meta: 'Staf HR · SDM', avatar: '/a.png' }),
            ),
        ).toEqual({
            id: '01H',
            name: 'Maya Lestari',
            note: 'Staf HR · SDM',
            avatar: '/a.png',
        });
    });

    it('ignores results that are not people', () => {
        expect(
            candidateFromResult(hit({ id: 'task:01H', title: 'Tugas' })),
        ).toBeNull();
    });
});

describe('period labels', () => {
    it('formats the window with Indonesian digits', () => {
        expect(windowLabel(period('pagi', 'open'))).toBe('08.00–11.00');
        expect(windowLabel(period('sore', 'open'))).toBe('16.00–18.00');
    });

    it('shortens the period name for segmented picks', () => {
        expect(shortPeriodLabel('pagi')).toBe('Pagi');
        expect(shortPeriodLabel('sore')).toBe('Sore');
    });
});
