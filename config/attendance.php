<?php

/*
|--------------------------------------------------------------------------
| Attendance (Absensi)
|--------------------------------------------------------------------------
|
| Business rules for check-in/out, consent, selfies and fraud flags.
| See docs/PRD.md M2 and docs/ARCHITECTURE.md §3.1, §3.3, §5.
|
*/

return [

    /*
    | Privacy policy shown on the consent screen (UU PDP No. 27/2022).
    | Bump the version whenever the policy text changes: every employee must
    | consent again before their next check-in.
    */
    'consent' => [
        'version' => env('ATTENDANCE_CONSENT_VERSION', '1.0'),
    ],

    'selfie' => [
        // Private disk (config/filesystems.php "selfies"): local in dev, s3 in production.
        'disk' => env('ATTENDANCE_SELFIE_DISK', 'selfies'),

        // Signed URL lifetime for viewing a selfie.
        'url_ttl_minutes' => 5,

        // The client compresses to ≤ 300 KB; the server accepts a little headroom.
        'max_kilobytes' => 600,

        // Retention before automatic deletion (monthly attendance:purge-selfies).
        'retention_months' => (int) env('ATTENDANCE_SELFIE_RETENTION_MONTHS', 12),

        // Mean luminance (0–255) below which a selfie is flagged as dark/empty.
        'dark_threshold' => 28,
    ],

    /*
    | Dynamic QR code on lobby kiosks (docs/ARCHITECTURE.md §3.2).
    | Code = HMAC-SHA256(secret, "{location_id}|{window}") with
    | window = floor(unix time / window_seconds). The server accepts the current
    | window ± tolerance_windows. An empty secret is derived from APP_KEY; set
    | ATTENDANCE_QR_SECRET in production so rotating APP_KEY does not matter.
    */
    'qr' => [
        'secret' => env('ATTENDANCE_QR_SECRET'),
        'window_seconds' => 30,
        'tolerance_windows' => 1,
        'scheme' => 'ruangkerja://checkin',

        // Displayed codes nobody scanned are pruned after this many days.
        'prune_after_days' => 2,

        // Kiosk activation links are single-use and expire after this many hours.
        'activation_ttl_hours' => 24,

        // "Baru saja check-in" on the kiosk screen.
        'recent_check_ins' => 5,

        // Refuse QR scans without GPS. Off: they are accepted but flagged
        // `qr_no_location` for HR review (a forwarded code works anywhere).
        'require_location' => (bool) env('ATTENDANCE_QR_REQUIRE_LOCATION', false),
    ],

    'geofence' => [
        'default_radius_m' => 100,
        'min_radius_m' => 50,
        'max_radius_m' => 500,
    ],

    'fraud' => [
        // GPS accuracy (metres) above which a log is flagged.
        'max_accuracy_m' => 100,

        // Allowed difference between device clock and server clock.
        'max_clock_skew_minutes' => 5,

        // Speed between two consecutive logs that is not physically plausible.
        'max_speed_kmh' => 150,

        // Ignore jumps shorter than this (GPS jitter).
        'min_travel_distance_m' => 1000,

        // How many previous logs are compared for "new device / new IP".
        'history_size' => 50,
    ],

    'schedule' => [
        // Defaults for new shifts.
        'default_check_in_window_before_min' => 120,
        'default_late_tolerance_min' => 10,

        // After the scheduled end a day stays open this long for check-out
        // (overtime, overnight shifts). Afterwards attendance:close-day may
        // mark a missing check-out as needs_correction.
        'checkout_grace_minutes' => 360,
    ],

    'reminder' => [
        // Remind employees this many minutes after their scheduled start.
        'delay_minutes' => 15,
    ],

    // Max check-in/check-out attempts per user per minute.
    'rate_limit_per_minute' => 6,

];
