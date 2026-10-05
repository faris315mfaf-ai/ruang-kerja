import type { AttendanceStatus } from '@/types/attendance';
import type { RequestStatus } from '@/types/requests';

/** Mirrors App\Domain\Privacy\Services\MyData (Sprint 10). */
export type MyProfile = {
    name: string;
    email: string;
    employee_number: string | null;
    /** Never the NIK in clear: last four digits only. */
    nik_masked: string | null;
    phone: string | null;
    birth_date: string | null;
    address: string | null;
    emergency_contact: string | null;
    division: string | null;
    team: string | null;
    position: string | null;
    manager: string | null;
    work_mode: string;
    status: string;
    joined_at: string | null;
    roles: string[];
    google_linked: boolean;
    two_factor: boolean;
    last_login_at: string | null;
};

export type ConsentRecord = {
    id: string;
    type: string;
    type_label: string;
    version: string;
    granted_at: string;
    revoked_at: string | null;
};

export type MyConsent = {
    granted: boolean;
    /** Version the attendance consent must match. */
    version: string;
    policy_version: string;
    granted_version: string | null;
    granted_at: string | null;
    needs_renewal: boolean;
    retention_months: number;
    history: ConsentRecord[];
};

export type MyAttendanceDay = {
    date: string;
    status: AttendanceStatus;
    status_label: string;
    shift: string | null;
    check_in: string | null;
    check_out: string | null;
    method: string | null;
    location: string | null;
    late_minutes: number;
    early_leave_minutes: number;
    work_minutes: number;
    overtime_minutes: number;
    note: string | null;
};

export type MyAttendance = {
    total_days: number;
    counts: Partial<Record<AttendanceStatus, number>>;
    first_date: string | null;
    logs: number;
    selfies: number;
    days: MyAttendanceDay[];
};

export type MyRequestItem = {
    id: string;
    number: string | null;
    type: string;
    summary: string;
    reason: string;
    status: RequestStatus;
    status_label: string;
    submitted_at: string | null;
    decided_at: string | null;
    url: string;
};

export type MyDecisionItem = {
    id: string;
    request_id: string;
    number: string | null;
    requester: string;
    type: string;
    summary: string;
    decision: 'approved' | 'rejected' | 'revision_requested';
    decision_label: string;
    note: string | null;
    decided_at: string | null;
    url: string;
};

export type Listing<T> = { count: number; items: T[] };

export type PrivacyPageProps = {
    policy: { version: string; effective_date: string };
    profile: MyProfile;
    consent: MyConsent;
    statusLabels: Record<string, string>;
    attendance?: MyAttendance;
    requests?: Listing<MyRequestItem>;
    decisions?: Listing<MyDecisionItem>;
};
