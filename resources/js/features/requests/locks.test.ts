import { describe, expect, it } from 'vitest';
import type { FormLeaveType } from '@/types/requests';
import { categoryLockReason, categoryLocked, firstOpenType } from './locks';

const type = (overrides: Partial<FormLeaveType>): FormLeaveType => ({
    id: 'x',
    code: 'X',
    name: 'Jenis',
    category: 'leave',
    category_label: 'Cuti',
    description: null,
    annual_quota_days: null,
    requires_attachment_after_days: null,
    allow_half_day: false,
    max_backdate_days: null,
    is_paid: true,
    eligible: true,
    balance: null,
    locked: false,
    locked_reason: null,
    ...overrides,
});

describe('request type locks', () => {
    it('locks a category only when every type is locked', () => {
        const locked = type({
            id: 'a',
            locked: true,
            locked_reason: 'Dikunci sampai SOP cuti/lembur ditetapkan.',
        });

        expect(categoryLocked({ types: [locked] })).toBe(true);
        expect(categoryLocked({ types: [locked, type({ id: 'b' })] })).toBe(
            false,
        );
        expect(categoryLocked({ types: [] })).toBe(false);
        expect(categoryLockReason({ types: [locked] })).toBe(
            'Dikunci sampai SOP cuti/lembur ditetapkan.',
        );
        expect(categoryLockReason({ types: [type({})] })).toBeNull();
    });

    it('picks the first open, eligible type', () => {
        const types = [
            type({ id: 'locked', locked: true }),
            type({ id: 'ineligible', eligible: false }),
            type({ id: 'open' }),
        ];

        expect(firstOpenType(types)?.id).toBe('open');
        expect(firstOpenType([types[0], types[1]])?.id).toBe('ineligible');
        expect(firstOpenType([types[0]])?.id).toBe('locked');
    });
});
