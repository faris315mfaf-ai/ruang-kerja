import type { RoleName } from '@/lib/roles';
import type { UserStatus, WorkMode } from '@/types/auth';

export type Option<T extends string = string> = { value: T; label: string };

export type Ref = { id: string; name: string };

export type EmployeeRow = {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    division: (Ref & { code: string }) | null;
    team: Ref | null;
    position: Ref | null;
    manager: (Ref & { avatar_url: string | null }) | null;
    work_mode: WorkMode;
    roles: RoleName[];
    status: UserStatus;
    joined_at: string | null;
    can: { update: boolean; deactivate: boolean };
};

export type ManagerOption = {
    id: string;
    name: string;
    avatar_url: string | null;
    position: string | null;
};

/** Values for the edit panel (`editing` prop). NIK is only ever masked. */
export type EmployeeFormValues = Omit<EmployeeRow, 'manager'> & {
    division_id: string | null;
    team_id: string | null;
    position_id: string | null;
    manager_id: string | null;
    manager: ManagerOption | null;
    email_locked: boolean;
    employee_number: string | null;
    phone: string | null;
    nik_masked: string | null;
    direct_reports_count: number;
};

export type DivisionOption = {
    id: string;
    name: string;
    code: string;
    count: number;
};

export type FormOptions = {
    teams: { id: string; name: string; division_id: string }[];
    positions: { id: string; name: string; level: number }[];
    managers: ManagerOption[];
};

export type EnumOptions = {
    roles: Option<RoleName>[];
    workModes: Option<WorkMode>[];
    statuses: Option<UserStatus>[];
};

export type EmployeeFilters = {
    search: string | null;
    division: string | null;
    role: RoleName | null;
    status: UserStatus | null;
    sort: string;
    direction: 'asc' | 'desc';
    per_page: number;
};

export type PaginationMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type EmployeeIndexProps = {
    employees: { data: EmployeeRow[]; meta: PaginationMeta };
    filters: EmployeeFilters;
    counts: { active: number; inactive: number };
    divisions: DivisionOption[];
    options: EnumOptions;
    can: { manage: boolean; assignSuperAdmin: boolean };
    companyDomain: string;
    formOptions: FormOptions | null;
    editing: EmployeeFormValues | null;
};

export type AuditEntry = {
    id: string;
    action: string;
    actor: string | null;
    fields: string[];
    reason: string | null;
    created_at: string;
};

export type EmployeeDetail = Omit<EmployeeRow, 'manager'> & {
    manager: ManagerOption | null;
    division_head: Ref | null;
    team_lead: Ref | null;
    last_login_at: string | null;
    employee_number: string | null;
    phone: string | null;
    nik_masked: string | null;
};

export type DirectReport = {
    id: string;
    name: string;
    avatar_url: string | null;
    position: string | null;
    status: UserStatus;
};

export type EmployeeShowProps = {
    employee: EmployeeDetail;
    directReports: DirectReport[];
    audit: AuditEntry[] | null;
    options: EnumOptions;
    can: { manage: boolean; update: boolean; deactivate: boolean };
};

export type ImportRowResult = {
    row: number;
    name: string | null;
    email: string | null;
    action: 'create' | 'update' | 'error';
    errors: string[];
};

export type ImportReport = {
    summary: { total: number; create: number; update: number; error: number };
    fileErrors: string[];
    rows: ImportRowResult[];
    created: number;
    updated: number;
};

export type EmployeeImportProps = {
    token: string | null;
    fileName: string | null;
    preview: ImportReport | null;
    result: ImportReport | null;
    expired: boolean;
    reference: {
        columns: string[];
        required: string[];
        maxRows: number;
        maxKilobytes: number;
        companyDomain: string;
        divisions: { code: string; name: string }[];
        positions: string[];
        roles: Option<RoleName>[];
        workModes: Option<WorkMode>[];
    };
};
