import { describe, expect, it } from 'vite-plus/test';

import { describeActivity } from './activity-text';
import type { ActivityItem } from './types';

function item(
    event: string,
    properties: Record<string, unknown>,
): ActivityItem {
    return {
        id: '1',
        event,
        properties,
        subject_id: 's',
        created_at: '2026-10-05T01:00:00Z',
        causer: null,
    };
}

describe('describeActivity', () => {
    it('describes task events in Indonesian', () => {
        expect(
            describeActivity(
                item('task.status_changed', {
                    key: 'OPS-142',
                    from: { name: 'Todo' },
                    to: { name: 'Sedang dikerjakan' },
                }),
            ),
        ).toBe('memindahkan OPS-142 dari Todo ke Sedang dikerjakan');
        expect(
            describeActivity(
                item('task.assigned', { key: 'OPS-1', user_ids: ['u1'] }),
                { u1: 'Rizky Aditya' },
            ),
        ).toBe('menugaskan OPS-1 ke Rizky Aditya');
        expect(
            describeActivity(
                item('task.due_date_changed', {
                    key: 'OPS-1',
                    to: '2026-10-09',
                }),
            ),
        ).toBe('mengubah tenggat OPS-1 menjadi 9 Okt');
        expect(
            describeActivity(
                item('task.priority_changed', { key: 'OPS-1', to: 1 }),
            ),
        ).toBe('mengubah prioritas OPS-1 menjadi Urgent');
        expect(
            describeActivity(
                item('workspace.member_role_changed', {
                    name: 'Sari',
                    to: 'admin',
                }),
            ),
        ).toBe('mengubah peran Sari menjadi Admin');
    });

    it('describes project tracking events', () => {
        expect(
            describeActivity(
                item('project.update_posted', {
                    health: 'at_risk',
                    decision_needed: true,
                }),
            ),
        ).toBe(
            'menulis update proyek (Berisiko) dan meminta keputusan Direksi',
        );
        expect(
            describeActivity(item('milestone.completed', { name: 'Go-live' })),
        ).toBe('menandai milestone “Go-live” selesai');
        expect(
            describeActivity(
                item('project.update_requested', { recipient: 'Putri' }),
            ),
        ).toBe('meminta update proyek dari Putri');
    });
});
