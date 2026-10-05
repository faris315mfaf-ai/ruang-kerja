/**
 * Attendance (Sprint 2) data shapes as sent by the server
 * (App\Http\Resources\Attendance\*). Instants are ISO-8601 UTC strings.
 */

export type AttendanceStatus =
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
    | 'needs_correction';

export type AttendanceMethod =
    | 'gps_selfie'
    | 'qr'
    | 'wfh'
    | 'manual'
    | 'face'
    | 'fingerprint';

export type AttendanceAction =
    | 'check_in'
    | 'check_out'
    | 'done'
    | 'unavailable';

export type WorkModeValue = 'office' | 'hybrid' | 'wfh' | 'field';

export type DaySchedule = {
    workDate: string;
    isWorkday: boolean;
    isHoliday: boolean;
    holidayName: string | null;
    isOverride: boolean;
    shiftName: string | null;
    hours: string | null;
    start: string | null;
    end: string | null;
    checkInOpensAt: string | null;
    lateThreshold: string | null;
    workMode: WorkModeValue;
    workModeLabel: string;
    allowsRemote: boolean;
};

export type AttendanceLogData = {
    id: string;
    type: 'check_in' | 'check_out';
    method: AttendanceMethod;
    methodLabel: string;
    occurredAt: string;
    locationName: string | null;
    distanceM: number | null;
    inside: boolean;
    note: string | null;
    isSuspicious: boolean;
    selfieUrl: string | null;
};

export type AttendanceDayData = {
    id: string;
    workDate: string;
    status: AttendanceStatus;
    statusLabel: string;
    shiftName: string | null;
    hours: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    workMinutes: number;
    isSuspicious: boolean;
    checkIn: AttendanceLogData | null;
    checkOut: AttendanceLogData | null;
};

export type OfficeLocationPoint = {
    id: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    radiusM: number;
};

export type TodayAttendance = {
    action: AttendanceAction;
    schedule: DaySchedule;
    day: AttendanceDayData | null;
    locations: OfficeLocationPoint[];
};

export type AttendanceConsentState = {
    granted: boolean;
    version: string;
    retentionMonths: number;
};

export type CheckResult = {
    type: 'check_in' | 'check_out';
    workDate: string;
    occurredAt: string;
    status: AttendanceStatus;
    statusLabel: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    workMinutes: number;
    minutesBeforeStart: number | null;
    method: AttendanceMethod;
    methodLabel: string;
    location: {
        name: string;
        distanceM: number;
        radiusM: number;
        inside: boolean;
    } | null;
    shift: { name: string; hours: string } | null;
    isSuspicious: boolean;
    selfieUrl: string | null;
};

export type RejectionReason =
    | 'consent_required'
    | 'already_checked_in'
    | 'already_checked_out'
    | 'not_checked_in'
    | 'too_early'
    | 'outside_geofence'
    | 'no_office_location'
    | 'note_required'
    | 'day_has_request'
    // Client-side reasons (not from the server's AttendanceRejection enum).
    | 'validation'
    | 'network'
    | 'rate_limited'
    | 'server';

export type CheckRejection = {
    reason: RejectionReason;
    message: string;
    context: {
        distance_m?: number;
        radius_m?: number;
        accuracy_m?: number | null;
        location?: {
            id: string;
            name: string;
            latitude: number;
            longitude: number;
            radius_m: number;
        };
        opens_at?: string;
        at?: string;
    };
};

/** Compact status shared with every page (sidebar widget, topbar button). */
export type AttendanceStatusSummary = {
    action: AttendanceAction;
    status: AttendanceStatus | null;
    statusLabel: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    lateMinutes: number;
    locationName: string | null;
    isRemote: boolean;
    shiftName: string | null;
    start: string | null;
    startLabel: string | null;
    end: string | null;
    endLabel: string | null;
    distanceM: number | null;
    isHoliday: boolean;
};
