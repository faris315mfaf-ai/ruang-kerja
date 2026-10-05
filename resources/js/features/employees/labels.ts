import type { UserStatus, WorkMode } from '@/types/auth';

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
    office: 'Kantor',
    hybrid: 'Hybrid',
    wfh: 'WFH',
    field: 'Lapangan',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
    active: 'Aktif',
    inactive: 'Nonaktif',
    resigned: 'Mengundurkan diri',
};

const AUDIT_ACTIONS: Record<string, string> = {
    'user.created': 'Karyawan ditambahkan',
    'user.updated': 'Data diubah',
    'user.roles_changed': 'Peran diubah',
    'user.deactivated': 'Dinonaktifkan',
    'user.reactivated': 'Diaktifkan kembali',
    'employee_profile.updated': 'Data pribadi diubah',
};

const FIELD_LABELS: Record<string, string> = {
    name: 'nama',
    email: 'email',
    division_id: 'divisi',
    team_id: 'tim',
    position_id: 'jabatan',
    manager_id: 'atasan',
    work_mode: 'mode kerja',
    status: 'status',
    joined_at: 'tanggal bergabung',
    roles: 'peran',
    employee_number: 'nomor karyawan',
    phone: 'telepon',
    nik: 'NIK',
    google_id: 'akun Google',
    password: 'sandi',
};

export function auditActionLabel(action: string): string {
    return AUDIT_ACTIONS[action] ?? action;
}

/** Human list of changed fields, e.g. "divisi, atasan". */
export function auditFieldsLabel(fields: readonly string[]): string {
    return fields
        .filter((field) => field !== 'reason')
        .map((field) => FIELD_LABELS[field] ?? field.replaceAll('_', ' '))
        .join(', ');
}

export const SORTABLE_COLUMNS = [
    'name',
    'division',
    'position',
    'manager',
    'work_mode',
    'status',
] as const;
