import type { Option, RecapPeriodData } from '@/types/attendance';

/**
 * Absensi › Pegawai (keputusan pemilik 20 Okt 2026): props of
 * AttendanceEmployeesController@index and the day detail JSON
 * (EmployeeDayPresenter). docs/fitur/absensi-gaji.md.
 */

/** AttendanceStatus value, or a grid-only code (AttendanceGrid::cell). */
export type CellCode =
    | 'present'
    | 'late'
    | 'early_leave'
    | 'absent'
    | 'leave'
    | 'permit'
    | 'sick'
    | 'business_trip'
    | 'holiday'
    | 'wfh'
    | 'needs_correction'
    | 'off'
    | 'future'
    | 'not_checked_in'
    | 'none';

export type GridCell = {
    date: string;
    code: CellCode;
    /** "08.02" office time. */
    check_in: string | null;
    check_out: string | null;
    manual: boolean;
    from_request: boolean;
    has_logs: boolean;
};

export type GridRow = {
    id: string;
    name: string;
    initials: string;
    division: string | null;
    position: string | null;
    cells: GridCell[];
    totals: {
        present: number;
        late: number;
        absent: number;
        permit_sick_leave: number;
    };
    problems: number;
};

export type GridToday = {
    present: number;
    not_checked_in: number;
    late: number;
    absent_month: number;
    needs_correction: number;
};

export type EmployeesPageProps = {
    period: RecapPeriodData;
    filters: {
        bulan: string;
        divisi: string | null;
        q: string | null;
        bermasalah: boolean;
    };
    divisions: Option[];
    grid: { rows: GridRow[]; today: GridToday | null };
    generatedAt: string;
    can: { set_status: boolean; payroll: boolean };
};

/** Statuses HR may set by hand (SetAttendanceStatus::ALLOWED). */
export type SettableStatus =
    | 'present'
    | 'late'
    | 'wfh'
    | 'business_trip'
    | 'permit'
    | 'sick'
    | 'leave'
    | 'absent'
    | 'holiday';

export type DayDetail = {
    employee: { id: string; name: string };
    date: string;
    scheduled: boolean;
    shift: string | null;
    holiday: string | null;
    exists: boolean;
    status: Exclude<
        CellCode,
        'off' | 'future' | 'not_checked_in' | 'none'
    > | null;
    status_label: string | null;
    check_in: string | null;
    check_out: string | null;
    late_minutes: number;
    manual: boolean;
    set_by: string | null;
    set_at: string | null;
    from_request: boolean;
    request: { number: string | null; type: string } | null;
    has_logs: boolean;
    locked: boolean;
    can: { set_status: boolean; clear: boolean };
    logs: {
        id: string;
        type: 'check_in' | 'check_out';
        method: string;
        method_label: string;
        at: string;
        occurred_at: string;
        note: string | null;
        corrected_by: string | null;
    }[];
    history: {
        action: string;
        label: string;
        actor: string | null;
        at: string;
        reason: string | null;
        from_status: string | null;
        to_status: string | null;
    }[];
    wage_effect: {
        paid: boolean;
        paid_days: number;
        pending: boolean;
        label: string;
        daily_wage: number | null;
    };
};

/** Who and which date the editor opens on. */
export type DayTarget = { employeeId: string; name: string; date: string };
