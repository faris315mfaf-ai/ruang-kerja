<?php

/*
|--------------------------------------------------------------------------
| "Kirim tautan desktop ke email saya" (POST /api/v1/tautan-desktop)
|--------------------------------------------------------------------------
|
| Features that exist on the web only (docs/PLATFORM.md §3) show a banner in
| the app with a button that emails the signed-in user a link to the page.
| Only internal web paths matching this allowlist may be linked, and the
| email always goes to the authenticated user's OWN address — the endpoint
| can never mail anybody else or link to an external host. The link is a
| plain absolute URL (APP_URL + path): the web login protects the page, so
| no token is embedded.
|
| Patterns use Str::is wildcards (`*`). A path must additionally pass the
| strict character check in SendDesktopLinkRequest (no query, fragment,
| `..`, `//`, or scheme).
|
*/

return [

    'allowed_paths' => [
        '/pengaturan/keamanan',
        '/settings/security',
        '/pengaturan/perangkat',
        '/organisasi/struktur',
        '/admin/*',
        '/manajemen',
        '/manajemen/*',
        '/hiring',
        '/hiring/*',
        '/absensi/rekap',
        '/absensi/kedisiplinan',
        '/absensi/kedisiplinan/*',
        '/portofolio',
        '/portofolio/*',
        '/okr',
        '/okr/*',
        '/otomasi',
        '/otomasi/*',
    ],

];
