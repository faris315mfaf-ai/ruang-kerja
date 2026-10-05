import type { AdminFlow, AdminOptions, FlowStep } from './types';

const SHORT: Record<string, string> = {
    direct_manager: 'Atasan',
    division_head: 'Kepala divisi',
};

export function stepShortLabel(step: FlowStep, options: AdminOptions): string {
    if (step.approver_type === 'role') {
        return (
            options.roles.find((role) => role.value === step.approver_role)
                ?.label ?? 'Peran'
        );
    }

    if (step.approver_type === 'user') {
        return (
            step.approver_user_name ??
            options.users.find((user) => user.id === step.approver_user_id)
                ?.name ??
            'Orang tertentu'
        );
    }

    return SHORT[step.approver_type] ?? step.approver_type;
}

/** "Atasan → HR → Direksi (bersyarat)". */
export function flowSummary(
    flow: AdminFlow | undefined,
    options: AdminOptions,
): string {
    if (!flow || flow.steps.length === 0) {
        return 'Atasan → HR';
    }

    return flow.steps
        .map(
            (step) =>
                `${stepShortLabel(step, options)}${step.condition ? ' (bersyarat)' : ''}`,
        )
        .join(' → ');
}

/** "<metric>_<op>" ↔ editor fields; minutes are edited as hours. */
export function parseCondition(
    condition: Record<string, number> | null,
): { metric: string; operator: string; value: number } | null {
    const entry = condition ? Object.entries(condition)[0] : undefined;

    if (!entry) {
        return null;
    }

    const match = /^(.+)_(gt|gte|lt|lte)$/.exec(entry[0]);

    if (!match) {
        return null;
    }

    const value = match[1] === 'days' ? entry[1] : entry[1] / 60;

    return {
        metric: match[1],
        operator: match[2],
        value: Math.round(value * 10) / 10,
    };
}

export function buildCondition(
    metric: string,
    operator: string,
    value: number,
): Record<string, number> {
    return {
        [`${metric}_${operator}`]:
            metric === 'days' ? value : Math.round(value * 60),
    };
}
