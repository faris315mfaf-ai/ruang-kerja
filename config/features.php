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
];
