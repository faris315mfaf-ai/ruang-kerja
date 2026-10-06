import { describe, expect, it } from 'vitest';
import { APPROVAL_ITEMS, ROLE_DASHBOARDS } from './fixtures';
import {
    emptyDashboard,
    isRoleKey,
    nextBugStep,
    pendingCount,
    reviewButtonLabel,
    toggleIndex,
    uatTally,
} from './lib';
import { ROLE_KEYS } from './types';

describe('role configs', () => {
    it('has one complete config per role', () => {
        for (const key of ROLE_KEYS) {
            const config = ROLE_DASHBOARDS[key];

            expect(config.key).toBe(key);
            expect(config.kpis).toHaveLength(4);
            expect(config.phone.tiles).toHaveLength(2);
            expect(config.list.rows.length).toBeGreaterThan(0);
            // at most one warm gradient per screen (KPI or side panel)
            const warm =
                config.kpis.filter((kpi) => kpi.tone === 'warm').length +
                (config.side.warm ? 1 : 0);

            expect(warm).toBeLessThanOrEqual(1);
            expect(
                config.kpis.filter((kpi) => kpi.tone === 'highlight'),
            ).toHaveLength(1);

            if (config.flowRow !== undefined) {
                expect(config.list.rows[config.flowRow]).toBeDefined();
            }
        }
    });

    it('recognises role keys from the URL', () => {
        expect(isRoleKey('dirut')).toBe(true);
        expect(isRoleKey('admin')).toBe(false);
    });

    it('empties every list for the empty preview', () => {
        const empty = emptyDashboard(ROLE_DASHBOARDS.hr);

        expect(empty.list.rows).toEqual([]);
        expect(empty.bars.items).toEqual([]);
        expect(empty.schedule).toEqual([]);
        expect(empty.side.items).toEqual([]);
        expect(empty.phone.rows).toEqual([]);
        expect(empty.flowRow).toBeUndefined();
        expect(empty.kpis).toBe(ROLE_DASHBOARDS.hr.kpis);
    });
});

describe('flows', () => {
    it('counts pending approvals', () => {
        const ids = APPROVAL_ITEMS.map((item) => item.id);

        expect(pendingCount(ids, {})).toBe(4);
        expect(
            pendingCount(ids, {
                lbr: 'approved',
                srv: 'rejected',
                psl: undefined,
            }),
        ).toBe(2);
    });

    it('tallies UAT runs', () => {
        expect(uatTally(148, 0, 200)).toEqual({
            done: 148,
            percent: 74,
            passRate: 74,
            next: 149,
            finished: false,
        });
        expect(uatTally(190, 10, 200)).toMatchObject({
            next: 200,
            finished: true,
        });
        expect(uatTally(0, 0, 0)).toMatchObject({ percent: 0, passRate: 0 });
    });

    it('walks the bug steps and loops back', () => {
        expect(nextBugStep(2, 4)).toBe(3);
        expect(nextBugStep(3, 4)).toBe(1);
    });

    it('toggles chip selections in order', () => {
        expect(toggleIndex([0, 3], 2)).toEqual([0, 2, 3]);
        expect(toggleIndex([0, 2, 3], 2)).toEqual([0, 3]);
    });

    it('labels the review button', () => {
        expect(reviewButtonLabel(3, false)).toBe('Setujui (3 terbuka)');
        expect(reviewButtonLabel(0, false)).toBe('Setujui & kirim');
        expect(reviewButtonLabel(0, true)).toBe('Disetujui');
    });
});
