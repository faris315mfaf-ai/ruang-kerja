import { describe, expect, it } from 'vitest';
import {
    checklistProgress,
    groupByStage,
    groupChecklist,
    hiringUrls,
    manualTargets,
    safeHref,
    scoreTotal,
} from './lib';
import type { CandidateCard, ChecklistEntry, InterviewQuestion } from './types';

function card(id: string, stage: CandidateCard['stage']): CandidateCard {
    return {
        id,
        full_name: id,
        email: null,
        position: { id: 'p', title: 'Posisi' },
        stage,
        source: 'manual',
        applied_at: '2026-10-05T00:00:00Z',
        has_cv: false,
        checklist: { done: 0, total: 0 },
        awaiting_me: false,
    };
}

function question(max: number, average: number | null): InterviewQuestion {
    return {
        id: `${max}-${average}`,
        prompt: 'Q',
        guidance: null,
        max_score: max,
        answer: null,
        my_score: null,
        scores: [],
        average,
    };
}

function item(partial: Partial<ChecklistEntry>): ChecklistEntry {
    return {
        id: Math.random().toString(36),
        label: 'Butir',
        role: 'hr',
        required: true,
        reviewer: null,
        checked_at: null,
        checked_by: null,
        note: null,
        can_check: true,
        can_delete: false,
        ...partial,
    };
}

describe('hiring lib', () => {
    it('never offers Diterima nor the current stage as a manual target', () => {
        expect(manualTargets('interview')).toEqual([
            'applied',
            'screening',
            'assessment',
            'final_review',
            'rejected',
        ]);
        expect(manualTargets('rejected')).not.toContain('hired');
    });

    it('groups candidates per stage in pipeline order', () => {
        const groups = groupByStage([
            card('a', 'applied'),
            card('b', 'hired'),
            card('c', 'applied'),
        ]);

        expect(Object.keys(groups)).toEqual([
            'applied',
            'screening',
            'interview',
            'assessment',
            'final_review',
            'hired',
            'rejected',
        ]);
        expect(groups.applied.map((c) => c.id)).toEqual(['a', 'c']);
        expect(groups.hired).toHaveLength(1);
    });

    it('totals the averages of the scored questions only', () => {
        expect(scoreTotal([question(5, null)])).toBeNull();
        expect(scoreTotal([question(5, 3.5), question(5, 4), question(10, null)])).toEqual({
            total: 7.5,
            max: 10,
            scored: 2,
        });
    });

    it('groups the checklist HR first, then per reviewer, and counts required items', () => {
        const dimas = { id: 'd', name: 'Dimas', avatar: null, position: null };
        const faris = { id: 'f', name: 'Faris', avatar: null, position: null };
        const items = [
            item({ role: 'approver', reviewer: faris }),
            item({ role: 'interviewer', reviewer: dimas, checked_at: '2026-10-05T00:00:00Z' }),
            item({ role: 'hr', required: false }),
            item({ role: 'hr' }),
        ];

        expect(groupChecklist(items).map((group) => group.title)).toEqual([
            'HR',
            'Dimas · Pewawancara',
            'Faris · Penyetuju akhir',
        ]);
        expect(checklistProgress(items)).toEqual({ done: 1, total: 3 });
    });

    it('only turns http(s) links into anchors', () => {
        expect(safeHref('https://drive.google.com/open?id=1')).toBe(
            'https://drive.google.com/open?id=1',
        );
        expect(safeHref('javascript:alert(1)')).toBeNull();
        expect(safeHref('bukan url')).toBeNull();
        expect(safeHref(null)).toBeNull();
    });

    it('builds the board URL with the filters', () => {
        expect(hiringUrls.index()).toBe('/hiring');
        expect(hiringUrls.index({ position: 'p1', q: 'nadia putri' })).toBe(
            '/hiring?lowongan=p1&q=nadia+putri',
        );
        expect(hiringUrls.candidate('c1', 'keputusan')).toBe(
            '/hiring/kandidat/c1?tab=keputusan',
        );
    });
});
