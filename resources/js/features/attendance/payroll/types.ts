import type { Option, RecapPeriodData } from '@/types/attendance';

/**
 * Absensi › Gaji (keputusan pemilik 20 Okt 2026): props of
 * PayrollController@index and the wage history JSON
 * (EmployeeWageController@index). docs/fitur/absensi-gaji.md §3.
 */

export type PayrollRow = {
    user_id: string;
    name: string;
    division_id: string | null;
    division: string | null;
    position: string | null;
    employee_number: string | null;
    daily_wage: number | null;
    wage_changed_in_period: boolean;
    missing_wage: boolean;
    present_days: number;
    paid_leave_days: number;
    unpaid_days: number;
    absent_days: number;
    late_count: number;
    pending_days: number;
    paid_days: number;
    gross: number;
    deduction: number;
    total: number;
};

export type PayrollRules = {
    pay_leave: boolean;
    pay_sick: boolean;
    pay_permit: boolean;
    late_deduction: number;
};

export type PayrollReport = {
    rows: PayrollRow[];
    totals: {
        employees: number;
        total: number;
        paid_days: number;
        unpaid_days: number;
        absent_days: number;
        pending_days: number;
    };
    rules: PayrollRules;
    period: {
        month: string;
        label: string;
        locked: boolean;
        locked_at: string | null;
        locked_by_name: string | null;
        workdays_elapsed: number;
        workdays_total: number;
        computed_at: string | null;
    };
};

export type PayrollPageProps = {
    period: RecapPeriodData;
    filters: { bulan: string; divisi: string | null; q: string | null };
    divisions: Option[];
    report: PayrollReport;
    generatedAt: string;
    can: { manage: boolean; export: boolean };
};

export type WageHistory = {
    employee: { id: string; name: string };
    current: number | null;
    wages: {
        id: string;
        daily_wage: number;
        effective_from: string;
        note: string | null;
        created_by_name: string | null;
        updated_at: string | null;
        locked: boolean;
    }[];
    can: { manage: boolean };
};
