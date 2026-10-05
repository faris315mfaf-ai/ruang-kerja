import { describe, expect, it } from 'vite-plus/test';
import { buildCondition, flowSummary, parseCondition } from './flow-summary';
import type { AdminOptions } from './types';

const options: AdminOptions = {
    categories: [],
    approver_types: [],
    roles: [
        { value: 'hr', label: 'HR' },
        { value: 'direksi', label: 'Direksi' },
    ],
    metrics: [],
    role_holders: {},
    users: [],
};

describe('flow conditions', () => {
    it('converts hours to stored minutes and back', () => {
        expect(buildCondition('overtime_month_minutes', 'gt', 40)).toEqual({
            overtime_month_minutes_gt: 2400,
        });
        expect(parseCondition({ overtime_month_minutes_gt: 2400 })).toEqual({
            metric: 'overtime_month_minutes',
            operator: 'gt',
            value: 40,
        });
        expect(parseCondition({ days_gte: 3 })).toEqual({
            metric: 'days',
            operator: 'gte',
            value: 3,
        });
        expect(parseCondition(null)).toBeNull();
    });

    it('summarises a flow', () => {
        expect(
            flowSummary(
                {
                    id: 'f',
                    name: 'Lembur',
                    is_default: false,
                    skip_self_approval: true,
                    allow_delegation: true,
                    leave_types_count: 1,
                    updated_at: null,
                    steps: [
                        {
                            approver_type: 'direct_manager',
                            approver_role: null,
                            approver_user_id: null,
                            condition: null,
                        },
                        {
                            approver_type: 'role',
                            approver_role: 'hr',
                            approver_user_id: null,
                            condition: null,
                        },
                        {
                            approver_type: 'role',
                            approver_role: 'direksi',
                            approver_user_id: null,
                            condition: { overtime_month_minutes_gt: 2400 },
                        },
                    ],
                },
                options,
            ),
        ).toBe('Atasan → HR → Direksi (bersyarat)');
        expect(flowSummary(undefined, options)).toBe('Atasan → HR');
    });
});
