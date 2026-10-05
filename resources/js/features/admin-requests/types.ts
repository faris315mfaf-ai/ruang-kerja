import type {
    ApproverType,
    LeaveTypeInfo,
    PlannedStep,
    RequestCategory,
} from '@/types/requests';

export type AdminLeaveType = LeaveTypeInfo & {
    approval_flow_id: string | null;
    carry_over_max_days: number | null;
    min_service_months: number | null;
    is_active: boolean;
    sort_order: number;
};

export type FlowStep = {
    approver_type: ApproverType;
    approver_role: string | null;
    approver_user_id: string | null;
    approver_user_name?: string | null;
    condition: Record<string, number> | null;
};

export type AdminFlow = {
    id: string;
    name: string;
    is_default: boolean;
    skip_self_approval: boolean;
    allow_delegation: boolean;
    leave_types_count: number;
    updated_at: string | null;
    steps: FlowStep[];
};

export type AdminOptions = {
    categories: { value: RequestCategory; label: string; slug: string }[];
    approver_types: { value: ApproverType; label: string }[];
    roles: { value: string; label: string }[];
    metrics: { value: string; label: string; unit: string }[];
    role_holders: Record<string, string[]>;
    users: { id: string; name: string }[];
    default_sample_id: string | null;
};

export type AdminRequestTypesProps = {
    types: AdminLeaveType[];
    flows: AdminFlow[];
    selected: string | null;
    options: AdminOptions;
};

export type FlowPreview = {
    sample: { id: string; name: string };
    overtime_month_minutes: number;
    steps: PlannedStep[];
};
