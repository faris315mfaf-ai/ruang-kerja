import type { WorkModeValue } from '@/types/attendance';

export type AdminLocation = {
    id: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    radiusM: number;
    isActive: boolean;
    employeesCount: number;
};

export type AdminShift = {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    hours: string;
    breakMinutes: number;
    crossesMidnight: boolean;
    lateToleranceMin: number;
    earlyLeaveToleranceMin: number;
    checkInWindowBeforeMin: number;
    officeLocationId: string | null;
    locationName: string | null;
    daysLabel: string | null;
    employeesCount: number;
};

export type AdminHoliday = {
    id: string;
    date: string;
    name: string;
    type: 'national' | 'collective_leave' | 'company';
    typeLabel: string;
};

export type Option = { value: string; label: string };

export type AttendanceSettingsProps = {
    locations: AdminLocation[];
    shifts: AdminShift[];
    holidays: AdminHoliday[];
    holidayYear: number | null;
    holidayYears: number[];
    holidayTypes: Option[];
    geofence: { defaultRadius: number; minRadius: number; maxRadius: number };
    shiftDefaults: { lateToleranceMin: number; checkInWindowBeforeMin: number };
};

export type AssignmentPattern = {
    id: string;
    shiftName: string | null;
    hours: string | null;
    weekdays: number[];
    daysLabel: string;
    validFrom: string;
    validUntil: string | null;
    workMode: WorkModeValue | null;
    workModeLabel: string | null;
};

export type AssignmentOverride = {
    id: string;
    date: string;
    shiftName: string | null;
    hours: string | null;
    workMode: WorkModeValue | null;
    workModeLabel: string | null;
};

export type AssignmentEmployee = {
    id: string;
    name: string;
    divisionId: string | null;
    divisionName: string | null;
    divisionCode: string | null;
    workMode: WorkModeValue;
    workModeLabel: string;
    patterns: AssignmentPattern[];
    overrides: AssignmentOverride[];
};

export type ShiftAssignmentsProps = {
    employees: AssignmentEmployee[];
    divisions: { id: string; name: string; code: string }[];
    shifts: { id: string; name: string; hours: string }[];
    workModes: Option[];
};

/** "2026-12-25" → "Jum, 25 Des 2026" without timezone drift. */
export function workDateLabel(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const value = new Date(Date.UTC(year, month - 1, day, 5));
    const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Agu',
        'Sep',
        'Okt',
        'Nov',
        'Des',
    ];

    return `${weekdays[value.getUTCDay()]}, ${day} ${months[month - 1]} ${year}`;
}
