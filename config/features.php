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

    // Rapat, notulen & kalender (Fase 2, F2-3) with a real backend: /rapat, /kalender,
    // /manajemen/jadwal, Dock tile. Google Calendar/Meet sync stays on hold.
    'meetings' => (bool) env('FEATURE_MEETINGS', env('APP_ENV', 'production') !== 'production'),
];
