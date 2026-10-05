import { roleLabel } from '@/lib/roles';
import type { AuditValues } from './types';

/** Audit action prefixes (`<subject>.<verb>`) in Indonesian. */
const SUBJECTS: Record<string, string> = {
    user: 'Karyawan',
    division: 'Divisi',
    team: 'Tim',
    position: 'Jabatan',
    company: 'Perusahaan',
    attendance: 'Absensi',
    request: 'Pengajuan',
    selfie: 'Selfie',
};

const VERBS: Record<string, string> = {
    created: 'dibuat',
    updated: 'diubah',
    deleted: 'dihapus',
    restored: 'dipulihkan',
    viewed: 'dilihat',
    approved: 'disetujui',
    rejected: 'ditolak',
    corrected: 'dikoreksi',
    imported: 'diimpor',
    deactivated: 'dinonaktifkan',
};

/** Actions whose wording does not follow "<Subjek> <kata kerja>". */
const SPECIAL: Record<string, string> = {
    'user.roles_changed': 'Peran karyawan diubah',
};

/** "division.updated" → "Divisi diubah"; unknown parts fall back to the raw text. */
export function actionLabel(action: string): string {
    if (SPECIAL[action]) {
        return SPECIAL[action];
    }

    const [subject, verb = ''] = action.split('.', 2);
    const subjectLabel = SUBJECTS[subject];
    const verbLabel = VERBS[verb];

    if (subjectLabel && verbLabel) {
        return `${subjectLabel} ${verbLabel}`;
    }

    return action;
}

/** "division." → "Semua aksi divisi". */
export function actionGroupLabel(prefix: string): string {
    const subject = SUBJECTS[prefix.replace(/\.$/, '')];

    return `Semua aksi ${(subject ?? prefix.replace(/\.$/, '')).toLowerCase()}`;
}

/** Select options: one "all actions of X" entry per prefix, then each action. */
export function actionOptions(
    actions: string[],
): { value: string; label: string; group: boolean }[] {
    const prefixes = [
        ...new Set(actions.map((action) => `${action.split('.')[0]}.`)),
    ];
    const result: { value: string; label: string; group: boolean }[] = [];

    for (const prefix of prefixes) {
        const members = actions.filter((action) => action.startsWith(prefix));

        if (members.length > 1) {
            result.push({
                value: prefix,
                label: actionGroupLabel(prefix),
                group: true,
            });
        }

        for (const action of members) {
            result.push({
                value: action,
                label: actionLabel(action),
                group: false,
            });
        }
    }

    return result;
}

const FIELDS: Record<string, string> = {
    id: 'ID',
    name: 'Nama',
    code: 'Kode',
    email: 'Email',
    is_board: 'Unit Direksi',
    parent_id: 'Induk divisi',
    head_user_id: 'Kepala divisi',
    lead_user_id: 'Ketua tim',
    company_id: 'Perusahaan',
    division_id: 'Divisi',
    team_id: 'Tim',
    position_id: 'Jabatan',
    manager_id: 'Atasan langsung',
    level: 'Level',
    status: 'Status',
    work_mode: 'Mode kerja',
    joined_at: 'Tanggal bergabung',
    roles: 'Peran',
    password: 'Kata sandi',
    google_id: 'ID Google',
    google_domain: 'Domain Google',
    timezone: 'Zona waktu',
    settings: 'Pengaturan',
    email_verified_at: 'Email terverifikasi',
    two_factor_secret: 'Rahasia 2FA',
    two_factor_recovery_codes: 'Kode pemulihan 2FA',
    two_factor_confirmed_at: '2FA dikonfirmasi',
};

export function fieldLabel(key: string): string {
    return FIELDS[key] ?? key;
}

const STATUS: Record<string, string> = {
    active: 'Aktif',
    inactive: 'Nonaktif',
    resigned: 'Mengundurkan diri',
};

const WORK_MODE: Record<string, string> = {
    office: 'Kantor',
    hybrid: 'Hybrid',
    wfh: 'WFH',
    field: 'Lapangan',
};

const EMPTY = '–';

/**
 * Human-readable audit value. Ids of known foreign keys are resolved through
 * `references` (id → name) sent by the server; enums get Indonesian labels.
 */
export function formatValue(
    key: string,
    value: unknown,
    references: Record<string, string> = {},
): string {
    if (value === null || value === undefined || value === '') {
        return EMPTY;
    }

    if (typeof value === 'boolean') {
        return value ? 'Ya' : 'Tidak';
    }

    if (key === 'roles' && Array.isArray(value)) {
        return value.length === 0
            ? 'Tanpa peran'
            : value.map((role) => roleLabel(String(role))).join(', ');
    }

    if (typeof value === 'string') {
        if (key.endsWith('_id') && references[value]) {
            return references[value];
        }

        if (key === 'status') {
            return STATUS[value] ?? value;
        }

        if (key === 'work_mode') {
            return WORK_MODE[value] ?? value;
        }

        return value;
    }

    if (typeof value === 'number') {
        return String(value);
    }

    return JSON.stringify(value);
}

export type DiffRow = {
    key: string;
    label: string;
    before: unknown;
    after: unknown;
    changed: boolean;
};

/** Field-by-field comparison of before/after values, in first-seen order. */
export function diffRows(
    before: AuditValues | null,
    after: AuditValues | null,
): DiffRow[] {
    const keys = [
        ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
    ];

    return keys.map((key) => {
        const oldValue = before?.[key] ?? null;
        const newValue = after?.[key] ?? null;

        return {
            key,
            label: fieldLabel(key),
            before: oldValue,
            after: newValue,
            changed: JSON.stringify(oldValue) !== JSON.stringify(newValue),
        };
    });
}

/** Short summary of changed fields for the table, e.g. "Nama, Kode +2" (without `id`). */
export function changeSummary(
    before: AuditValues | null,
    after: AuditValues | null,
    max = 3,
): string {
    const changed = diffRows(before, after)
        // The primary key is noise in a summary (still shown in the drawer).
        .filter((row) => row.changed && row.key !== 'id')
        .map((row) => row.label);

    if (changed.length === 0) {
        return EMPTY;
    }

    const shown = changed.slice(0, max).join(', ');

    return changed.length > max ? `${shown} +${changed.length - max}` : shown;
}
