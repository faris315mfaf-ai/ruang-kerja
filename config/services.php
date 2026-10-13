<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Google Workspace sign-in (Socialite). Login is disabled until all three are set.
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', '/auth/google/callback'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Self-hosted Evolution API gateway (WhatsApp Web over REST;
    // docs/fitur/absensi-whatsapp.md). Used only while
    // NOTIFICATIONS_WHATSAPP_ENABLED=true.
    'evolution' => [
        'url' => env('EVOLUTION_URL'),
        'api_key' => env('EVOLUTION_API_KEY'),
        'instance' => env('EVOLUTION_INSTANCE', 'ruangkerja'),
    ],

    // OpenStreetMap tiles + Nominatim reverse geocoding for the stamped selfie
    // sent to the WhatsApp group. Their usage policy requires a descriptive
    // User-Agent with contact information.
    'osm' => [
        'user_agent' => env('OSM_USER_AGENT', 'RuangKerja/1.0 (+https://spkd.store)'),
        'tile_url' => env('OSM_TILE_URL', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'nominatim_url' => env('OSM_NOMINATIM_URL', 'https://nominatim.openstreetmap.org/reverse'),
    ],

    // Firebase Cloud Messaging (HTTP v1) for push to the Android app
    // (docs/sesi/ponsel-b2c-inbox.md). Both values empty = push is a no-op
    // (logged, notifications still reach the Inbox).
    'fcm' => [
        'project_id' => env('FCM_PROJECT_ID'),
        // Absolute path of the Firebase service-account JSON (keep it outside git, e.g. secrets/).
        'service_account_json' => env('FCM_SERVICE_ACCOUNT_JSON'),
    ],

];
