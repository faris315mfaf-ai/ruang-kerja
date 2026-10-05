<?php

/*
|--------------------------------------------------------------------------
| Branding
|--------------------------------------------------------------------------
|
| Identity shown in the app shell, emails, PWA manifest and PDF exports.
| These colors are reference values for non-CSS surfaces (manifest, email,
| PDF). UI colors must come from the CSS tokens in resources/css/tokens.css;
| keep both in sync when the brand palette changes.
|
*/

return [

    'name' => env('APP_NAME', 'RuangKerja'),

    'company_name' => env('BRANDING_COMPANY_NAME', '[Nama Perusahaan]'),

    // Used when no logo is configured (initials in the brand mark).
    'short_name' => 'RK',

    // Public path to the logo image, e.g. "/images/logo.svg". Null renders the
    // initials (short_name) on the brand gradient instead.
    'logo' => env('BRANDING_LOGO') ?: null,

    'colors' => [
        'primary_light' => '#0B7F86',
        'primary_dark' => '#2DBFB1',
        'gradient' => [
            'from' => '#14B8A6',
            'to' => '#2F7BEA',
        ],
    ],

];
