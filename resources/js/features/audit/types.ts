/** Props of Admin › Audit log (Admin\AuditLogController::index). */
export type AuditValues = Record<string, unknown>;

export type AuditRow = {
    id: string;
    action: string;
    createdAt: string;
    actor: { id: string; name: string; avatar: string | null } | null;
    subject: {
        /** AuditSubject value (karyawan, divisi, …) or null for other models. */
        type: string | null;
        typeLabel: string;
        id: string | null;
        name: string | null;
        deleted: boolean;
    } | null;
    oldValues: AuditValues | null;
    newValues: AuditValues | null;
    ipAddress: string | null;
    userAgent: string | null;
};

export type AuditFilters = {
    aktor: string | null;
    aksi: string | null;
    subjek: string | null;
    dari: string | null;
    sampai: string | null;
};

export type AuditPage = {
    data: AuditRow[];
    currentPage: number;
    lastPage: number;
    total: number;
    from: number | null;
    to: number | null;
    prevUrl: string | null;
    nextUrl: string | null;
};

export type AuditOptions = {
    actors: { value: string; label: string }[];
    actions: string[];
    subjects: { value: string; label: string }[];
};
