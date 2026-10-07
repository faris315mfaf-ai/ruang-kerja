<?php

/*
|--------------------------------------------------------------------------
| Feature flags
|--------------------------------------------------------------------------
|
| `prototype`: front-end previews of Fase 2 & 3 (chat, notes, meetings,
| automation, mobile app, OKR, role dashboards) at /pratinjau and the routes
| in routes/prototype.php. They run on sample data in the browser and save
| nothing. Off in production unless FEATURE_PROTOTYPE=true.
|
*/

return [
    'prototype' => (bool) env('FEATURE_PROTOTYPE', env('APP_ENV', 'production') !== 'production'),

    // Obrolan (Fase 2, F2-1) with a real backend: /obrolan, Dock tile.
    // Off in production until the release is decided.
    'chat' => (bool) env('FEATURE_CHAT', env('APP_ENV', 'production') !== 'production'),

    // Dashboard per jabatan (F3, /peran/{role}): job dashboards mapped from
    // positions.dashboard_role. Off in production until the release is decided.
    'role_dashboards' => (bool) env('FEATURE_ROLE_DASHBOARDS', env('APP_ENV', 'production') !== 'production'),
    // OKR divisi (Fase 3, F3-3) with a real backend: /okr, Dock/Rail tile,
    // Menu row. Off in production until the release is decided.
    'okr' => (bool) env('FEATURE_OKR', env('APP_ENV', 'production') !== 'production'),
    // Otomasi (aturan, tugas berulang, template) + Kinerja saya (Fase 2,
    // F2-4) with a real backend: /otomasi*, /kinerja, Dock tile.
    'automation' => (bool) env('FEATURE_AUTOMATION', env('APP_ENV', 'production') !== 'production'),
    // Catatan bersama (Fase 2, F2-2) with a real backend: /catatan, Dock tile,
    // collab server in collab/ (COLLAB_*). Off in production until decided.
    'notes' => (bool) env('FEATURE_NOTES', env('APP_ENV', 'production') !== 'production'),
    // Rapat, notulen & kalender (Fase 2, F2-3) with a real backend: /rapat, /kalender,
    // /manajemen/jadwal, Dock tile. Google Calendar/Meet sync stays on hold.
    'meetings' => (bool) env('FEATURE_MEETINGS', env('APP_ENV', 'production') !== 'production'),
];
