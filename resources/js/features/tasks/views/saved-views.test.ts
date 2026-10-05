import { describe, expect, it } from 'vite-plus/test';
import { EMPTY_FILTERS } from '../lib/filters';
import type { SavedView } from '../types';
import { isCurrentView, savedViewUrl } from './saved-views';

const view = (over: Partial<SavedView> = {}): SavedView => ({
    id: '1',
    name: 'Tugas saya',
    layout: 'list',
    filters: {
        assignees: ['me'],
        priorities: [1],
        labels: [],
        due: 'week',
        q: '',
    },
    is_shared: true,
    mine: false,
    owner: 'Dimas',
    ...over,
});

describe('savedViewUrl', () => {
    it('resolves "me" and keeps the layout', () => {
        expect(savedViewUrl('/w/PLQ', view(), 'u1')).toBe(
            '/w/PLQ?assignee=u1&priority=1&due=week&view=list',
        );
    });

    it('omits the board layout and empty filters', () => {
        expect(
            savedViewUrl(
                '/w/PLQ',
                view({ layout: 'board', filters: { ...EMPTY_FILTERS } }),
                'u1',
            ),
        ).toBe('/w/PLQ');
    });
});

describe('isCurrentView', () => {
    it('matches the current layout and filters', () => {
        const filters = {
            ...EMPTY_FILTERS,
            assignees: ['u1'],
            priorities: [1 as const],
            due: 'week' as const,
        };

        expect(isCurrentView(view(), 'list', filters, 'u1')).toBe(true);
        expect(isCurrentView(view(), 'board', filters, 'u1')).toBe(false);
        expect(isCurrentView(view(), 'list', EMPTY_FILTERS, 'u1')).toBe(false);
    });
});
