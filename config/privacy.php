<?php

/*
|--------------------------------------------------------------------------
| Privacy (UU PDP No. 27/2022) — Sprint 10
|--------------------------------------------------------------------------
|
| The privacy policy text lives in resources/markdown/privacy-policy.md
| (Markdown, Indonesian) so the owner can edit it without touching code.
| Placeholders filled in at render time: {{aplikasi}}, {{perusahaan}},
| {{versi}}, {{tanggal_berlaku}}, {{retensi_selfie_bulan}}, {{kontak}}.
|
| Bump `version` whenever the text changes in substance. The attendance
| consent (location + selfie) follows this version unless
| ATTENDANCE_CONSENT_VERSION is set (config/attendance.php), so every
| employee is asked to consent again before their next GPS/selfie check-in.
|
| History:
|   1.0 (2026-10-05)  first policy.
|   2.0 (2026-10-14)  stamped selfie + location sent to the company WhatsApp
|                     group, OpenStreetMap maps/Nominatim, Android offline
|                     storage (encrypted queue incl. selfie/GPS).
|
*/

return [

    'policy' => [
        'version' => env('PRIVACY_POLICY_VERSION', '2.0'),
        // Date the version took effect (YYYY-MM-DD).
        'effective_date' => env('PRIVACY_POLICY_DATE', '2026-10-14'),
        'path' => resource_path('markdown/privacy-policy.md'),
        // Who handles privacy requests (shown in the policy), e.g. "HR (hr@perusahaan.co.id)".
        'contact' => env('PRIVACY_CONTACT', 'tim HR'),
    ],

    // "Data Saya" page: how much is listed on screen (exports contain everything).
    'page' => [
        'attendance_days' => 31,
        'requests' => 20,
        'decisions' => 20,
    ],

];
