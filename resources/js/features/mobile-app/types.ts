/**
 * Fase 3 mobile app (F3-1 biometrics & face check-in, F3-2 integrity &
 * offline). Shapes follow docs/DATABASE.md §8 (`devices`, `face_templates`)
 * and §2 (`attendance_consents` type `face`, `attendance_logs.method = face`)
 * so a controller can later pass the same props instead of the fixtures.
 */

/** Preview state picked with `?keadaan=` (normal · kosong · galat). */
export type PreviewState = 'normal' | 'kosong' | 'galat';

export type DevicePlatform = 'android' | 'ios';

/** One verdict of Play Integrity / App Attest + our own checks. */
export type IntegrityCheckKey =
    | 'mock_location'
    | 'rooted'
    | 'unofficial_app'
    | 'clock_skew';

/** `devices.integrity_verdict` (jsonb). */
export type IntegrityVerdict = {
    checked_at: string;
    /** Failed checks; empty = device passed. */
    failed: IntegrityCheckKey[];
    /** Detected app name for mock location, e.g. "Fake GPS Go". */
    mock_app?: string | null;
};

/** `devices` row (device_id_hash / push_token stay on the server). */
export type Device = {
    id: string;
    user_id: string;
    platform: DevicePlatform;
    /** Marketing name reported by the app ("iPhone 13"). */
    name: string;
    os_version: string;
    app_version: string;
    integrity_verdict: IntegrityVerdict;
    last_seen_at: string;
    is_trusted: boolean;
    /** True for the device rendering this page. */
    is_current: boolean;
    biometric_login: boolean;
};

/** `attendance_consents` row of type `face`. */
export type FaceConsent = {
    id: string;
    type: 'face';
    version: string;
    granted_at: string;
    revoked_at: string | null;
};

/** `face_templates` row (the encrypted template itself never leaves the server). */
export type FaceTemplate = {
    id: string;
    user_id: string;
    model_version: string;
    consent_id: string;
    created_at: string;
};

/** Text of the biometric consent screen (UU PDP: explicit, versioned). */
export type BiometricPolicy = {
    version: string;
    published_on: string;
    points: string[];
};

export type ShiftToday = {
    name: string;
    start: string;
    end: string;
    location: string;
    distance_m: number;
    radius_m: number;
};

// --- Offline queue (MOffline) -------------------------------------------------

export type SyncKind = 'check_in' | 'comment' | 'status' | 'note';

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'sent';

export type SyncItem = {
    id: string;
    kind: SyncKind;
    title: string;
    meta: string;
    /** Local time the action was taken (ISO). */
    queued_at: string;
    status: SyncStatus;
    /** Human reason after a failed attempt. */
    error?: string | null;
    /** Simulation: the first attempt fails (conflict) and a retry succeeds. */
    fails_once?: boolean;
    attempts: number;
};

export type NetworkState = 'offline' | 'online';

// --- Lock screen, widget, quick add -----------------------------------------------

export type LockNotificationKind =
    | 'leave_request'
    | 'check_in_reminder'
    | 'meeting'
    | 'overtime_group'
    | 'task';

export type LockNotification = {
    id: string;
    kind: LockNotificationKind;
    title: string;
    body: string;
    /** "sekarang", "08.40". */
    time: string;
    primary?: string | null;
    secondary?: string | null;
    /** Primary action needs Face ID before it runs (approve). */
    needs_auth?: boolean;
    /** Opens the app at this route after unlocking. */
    href?: string | null;
};

export type AttendanceWidgetState = 'not_checked_in' | 'checked_in' | 'done';

export type WidgetTask = {
    id: string;
    key: string;
    title: string;
    done: boolean;
    overdue: boolean;
};

export type QuickActionKey =
    | 'check_in'
    | 'task'
    | 'leave'
    | 'note'
    | 'meeting'
    | 'issue';

export type QuickCreated = {
    id: string;
    kind: QuickActionKey;
    title: string;
    meta: string;
    created_at: string;
};
