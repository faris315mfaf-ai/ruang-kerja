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
    /** Share of the date covered by an approved absence request. */
    requestPortion: 'full' | 'half_day' | null;
    checkIn: AttendanceLogData | null;
    checkOut: AttendanceLogData | null;
    /** "Laporan kerja" points written at check-out (null until filled). */
    workReport?: string[] | null;
};

export type OfficeLocationPoint = {
    id: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    radiusM: number;
};

/** One company "jam absen" range, `HH:MM` office time; a null bound is open. */
export type AttendanceWindowRange = {
    from: string | null;
    until: string | null;
};

/** Company check-in / check-out hours (null = no limit configured). */
export type AttendanceWindows = {
    checkIn: AttendanceWindowRange | null;
    checkOut: AttendanceWindowRange | null;
};

/** Why the next check-in is closed right now (keputusan pemilik 13 Okt 2026). */
export type CheckInBlocked = {
    code: 'too_early' | 'window_closed';
    message: string;
    opensAt: string | null;
};

export type TodayAttendance = {
    action: AttendanceAction;
    schedule: DaySchedule;
    day: AttendanceDayData | null;
    locations: OfficeLocationPoint[];
    windows: AttendanceWindows;
    /** False for overnight shifts: the company hours do not govern them. */
    windowsApply: boolean;
    /** Only while `action = check_in` and outside the hours. */
    checkInBlocked: CheckInBlocked | null;
    /** Indonesian reason while `action = check_out` and outside the hours. */
    checkOutBlockedReason: string | null;
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
        /** Null for a QR scan without GPS. */
        distanceM: number | null;
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
    | 'check_in_window'
    | 'check_out_window'
    | 'outside_geofence'
    | 'no_office_location'
    | 'note_required'
    | 'day_has_request'
    | 'qr_invalid'
    | 'qr_expired'
    | 'qr_wrong_location'
    | 'qr_location_required'
    // Client-side reasons (not from the server's AttendanceRejection enum).
    | 'validation'
    | 'network'
    | 'rate_limited'
    | 'server';

export type CheckRejection = {
    reason: RejectionReason;
    message: string;
    /** First message per field of a Laravel 422 (`validation` only). */
    errors?: Record<string, string>;
    context: {
        /** `check_in_window` / `check_out_window`: before opening or after closing. */
        phase?: 'before' | 'after';
        from?: string | null;
        until?: string | null;
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

/* ------------------------------------------------------------------ */
/* Sprint 3 — kiosk QR, HR board, monthly recap                        */
/* ------------------------------------------------------------------ */

export type CheckMethod = 'gps' | 'qr';

export type KioskCode = {
    payload: string;
    /** Inline SVG rendered by the server (modules use currentColor). */
    svg: string;
    window: number;
    validFrom: string;
    validUntil: string;
};

export type KioskRecentCheckIn = {
    id: string;
    name: string;
    initials: string;
    at: string | null;
};

export type KioskState = {
    code: KioskCode;
    serverTime: string;
    recent: KioskRecentCheckIn[];
};

export type LogFlagItem = { value: string; label: string };

export type BoardPersonState =
    | 'on_time'
    | 'late'
    | 'leave'
    | 'not_checked_in'
    | 'off';

export type BoardPerson = {
    id: string;
    name: string;
    initials: string;
    divisionId: string | null;
    divisionName: string;
    locationId: string | null;
    locationName: string | null;
    shiftName: string;
    scheduled: boolean;
    state: BoardPersonState;
    status: AttendanceStatus | null;
    statusLabel: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    lateMinutes: number;
    method: AttendanceMethod | null;
    isSuspicious: boolean;
};

export type BoardDivision = {
    id: string | null;
    name: string;
    scheduled: number;
    onTime: number;
    late: number;
    onLeave: number;
    notCheckedIn: number;
};

export type TodayBoardData = {
    date: string;
    generatedAt: string;
    summary: {
        scheduled: number;
        shifts: { name: string; count: number }[];
        present: number;
        late: number;
        onLeave: number;
        leaveBreakdown: {
            status: AttendanceStatus;
            label: string;
            count: number;
        }[];
        notCheckedIn: number;
    };
    divisions: BoardDivision[];
    people: BoardPerson[];
};

export type SuspiciousLog = {
    id: string;
    userId: string;
    name: string;
    initials: string;
    divisionName: string | null;
    type: 'check_in' | 'check_out';
    typeLabel: string;
    method: AttendanceMethod;
    methodLabel: string;
    occurredAt: string;
    clientTime: string | null;
    locationName: string | null;
    radiusM: number | null;
    accuracyM: number | null;
    distanceM: number | null;
    note: string | null;
    flags: LogFlagItem[];
    hasSelfie: boolean;
    canViewSelfie: boolean;
    canReview: boolean;
};

export type MissingCheckOut = {
    dayId: string;
    userId: string;
    name: string;
    initials: string;
    workDate: string;
    shiftName: string | null;
    locationName: string | null;
    checkInAt: string | null;
};

export type Option = { id: string; name: string };

export type RecapPeriodData = {
    month: string;
    label: string;
    start: string;
    end: string;
    countedUntil: string | null;
    isRunning: boolean;
    previous: string;
    next: string;
};

export type RecapRow = {
    userId: string;
    name: string;
    initials: string;
    divisionName: string | null;
    positionName: string | null;
    shiftName: string | null;
    workDays: number;
    presentDays: number;
    lateCount: number;
    lateMinutes: number;
    earlyLeaveCount: number;
    absentDays: number;
    leaveDays: number;
    permitDays: number;
    sickDays: number;
    businessTripDays: number;
    wfhDays: number;
    needsCorrectionDays: number;
    offDays: number;
    overtimeHours: number;
    attendanceRate: number | null;
    averageCheckIn: string | null;
    suspiciousDays: number;
};

/** Calendar cell kind: a status value or off / holiday / upcoming / none. */
export type RecapDayKind = AttendanceStatus | 'off' | 'upcoming' | 'none';

export type RecapLog = AttendanceLogData & {
    typeLabel: string;
    accuracyM: number | null;
    flags: LogFlagItem[];
    reviewedAt: string | null;
    isCorrection: boolean;
    hasSelfie: boolean;
    canViewSelfie: boolean;
    canReview: boolean;
};

export type RecapDayCell = {
    date: string;
    kind: RecapDayKind;
    isWorkday: boolean;
    holidayName: string | null;
    dayId: string | null;
    statusLabel: string | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    workMinutes: number;
    overtimeMinutes: number;
    isSuspicious: boolean;
    shiftName: string | null;
    checkIn: AttendanceLogData | null;
    checkOut: AttendanceLogData | null;
};

export type RecapDetail = RecapRow & {
    days: RecapDayCell[];
    logs: RecapLog[];
};

export type RecapReportData = {
    summary: {
        employees: number;
        calendarWorkDays: number;
        weekendDays: number;
        holidayDays: number;
        attendanceRate: number | null;
        lateCount: number;
        overtimeHours: number;
        lateToleranceMin: number;
    };
    rows: RecapRow[];
};
