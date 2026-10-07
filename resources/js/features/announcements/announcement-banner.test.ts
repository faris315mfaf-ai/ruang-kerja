import { describe, expect, it } from 'vitest';
import { withoutAnnouncement } from './announcement-banner';
import type { Announcement } from './types';

const item = (id: string): Announcement => ({
    id,
    title: id,
    body: '',
    audience: 'all',
    audience_label: 'Semua karyawan',
    author: null,
    published_at: '2026-10-07T01:00:00Z',
    expires_at: null,
    active: true,
    dismissed: false,
    can_delete: false,
});

describe('withoutAnnouncement', () => {
    it('removes the closed banner and lowers the total', () => {
        expect(
            withoutAnnouncement(
                { items: [item('a'), item('b')], total: 5 },
                'a',
            ),
        ).toEqual({ items: [item('b')], total: 4 });
    });

    it('keeps everything for an unknown id', () => {
        expect(
            withoutAnnouncement({ items: [item('a')], total: 1 }, 'x'),
        ).toEqual({ items: [item('a')], total: 1 });
    });
});
