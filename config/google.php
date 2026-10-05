<?php

/*
|--------------------------------------------------------------------------
| Google Workspace integration (Drive, Docs, Picker)
|--------------------------------------------------------------------------
|
| Empty values switch the feature off gracefully: jobs become no-ops and the
| UI shows a friendly "fitur Google nonaktif" message. See
| docs/sprints/sprint-7/GOOGLE-API.md for the Google Cloud setup.
|
*/

$appUrl = rtrim((string) env('APP_URL', 'http://localhost'), '/');

return [

    /*
    | In-memory/cache-backed fake Drive client instead of Google. Always on in
    | the test suite (phpunit.xml). Ignored in production.
    */
    'fake' => (bool) env('GOOGLE_FAKE', false),

    /*
    | Service account with domain-wide delegation. `credentials` is the path to
    | the JSON key file (e.g. secrets/google-sa.json) or the JSON itself.
    | Folder, permission, document and upload calls impersonate `impersonate`.
    */
    'service_account' => [
        'credentials' => env('GOOGLE_SERVICE_ACCOUNT_JSON'),
        'impersonate' => env('GOOGLE_IMPERSONATE_USER'),
        'scopes' => ['https://www.googleapis.com/auth/drive'],
        'token_uri' => 'https://oauth2.googleapis.com/token',
    ],

    // Shared Drive "RuangKerja" that holds every workspace folder.
    'shared_drive_id' => env('GOOGLE_SHARED_DRIVE_ID'),

    // Display name of that Shared Drive in the File tab breadcrumb.
    'shared_drive_name' => env('GOOGLE_SHARED_DRIVE_NAME', 'RuangKerja'),

    /*
    | Per-user OAuth (incremental auth) used by Google Picker. The redirect
    | differs from the login callback (/auth/google/callback); register both
    | in the OAuth client.
    */
    'oauth' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_DRIVE_REDIRECT_URI', $appUrl.'/google/connect/callback'),
        'scopes' => ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
        'allowed_domain' => env('GOOGLE_ALLOWED_DOMAIN'),
        'token_uri' => 'https://oauth2.googleapis.com/token',
        'revoke_uri' => 'https://oauth2.googleapis.com/revoke',
    ],

    'picker' => [
        'api_key' => env('GOOGLE_PICKER_API_KEY'),
        // Cloud project number; derived from GOOGLE_CLIENT_ID when empty.
        'app_id' => env('GOOGLE_PICKER_APP_ID'),
    ],

    // Seconds. `sync_timeout` applies to calls made while the user waits.
    'http' => [
        'timeout' => 30,
        'sync_timeout' => 10,
        'connect_timeout' => 5,
        'upload_timeout' => 120,
    ],

    // Queued jobs: exponential backoff base * 2^(attempt-1), capped, plus jitter.
    'retry' => [
        'tries' => 6,
        'base_delay' => 10,
        'max_delay' => 900,
        'jitter' => true,
        // 403 reasons that mean "slow down" rather than "forbidden".
        'rate_limit_reasons' => [
            'rateLimitExceeded',
            'userRateLimitExceeded',
            'sharingRateLimitExceeded',
            'dailyLimitExceeded',
            'backendError',
        ],
    ],

    'upload' => [
        'max_bytes' => 100 * 1024 * 1024,
        // Must be a multiple of 256 KiB (Drive resumable protocol).
        'chunk_bytes' => 8 * 1024 * 1024,
        'disk' => 'local',
        'directory' => 'drive-uploads',
        // Per user: unfinished sessions and their declared bytes that may sit on
        // the server's disk at once (protects the disk from upload floods).
        'max_open_sessions' => (int) env('GOOGLE_UPLOAD_MAX_OPEN_SESSIONS', 5),
        'max_pending_bytes' => (int) env('GOOGLE_UPLOAD_MAX_PENDING_BYTES', 300 * 1024 * 1024),
        // New upload sessions per user per minute (POST …/unggah).
        'starts_per_minute' => (int) env('GOOGLE_UPLOAD_STARTS_PER_MINUTE', 20),
    ],

    'folders' => [
        // Folder listing cache in drive_files is refreshed when older than this.
        'stale_after_minutes' => 5,
    ],

    'permissions' => [
        // Drive e-mails on every share would duplicate the app's own notifications.
        'notify' => false,
        // Direct permissions that sync never revokes (lower-case e-mails).
        'protected_emails' => array_values(array_filter(array_map(
            static fn (string $email): string => strtolower(trim($email)),
            explode(',', (string) env('GOOGLE_PROTECTED_EMAILS', '')),
        ))),
    ],

];
