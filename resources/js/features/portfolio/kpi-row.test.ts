import { describe, expect, it } from 'vitest';
import { decisionNote } from './kpi-row';
import type { DecisionItem } from './types';

function decision(key: string, id: string): DecisionItem {
    return {
        id,
        project: { id: key, key, name: key } as DecisionItem['project'],
        decision: 'Keputusan',
        summary: '',
        author: null,
        created_at: '2026-10-01T00:00:00Z',
        can_resolve: true,
    };
}

describe('decisionNote', () => {
    it('names the projects that wait for a decision', () => {
        expect(decisionNote([])).toBe('Tidak ada keputusan tertunda');
        expect(decisionNote([decision('PLQ', 'a')])).toBe(
            'Dari PLQ · tinjau di bawah',
        );
        expect(decisionNote([decision('PLQ', 'a'), decision('PLQ', 'b')])).toBe(
            'Semua dari PLQ · tinjau di bawah',
        );
        expect(decisionNote([decision('PLQ', 'a'), decision('MSG', 'b')])).toBe(
            'Dari PLQ, MSG · tinjau di bawah',
        );
    });
});
