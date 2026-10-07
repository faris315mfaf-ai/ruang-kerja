<?php

/*
|--------------------------------------------------------------------------
| Rapat video RuangKerja (LiveKit SFU)
|--------------------------------------------------------------------------
|
| Built-in video meetings (docs/fitur/rapat-kalender.md §6a, deploy guide
| docs/deploy/RAPAT-VIDEO.md). The platform "Video RuangKerja" is offered
| only when url, key and secret are all set; otherwise the option is hidden
| and existing video meetings show a friendly note.
|
| - url: browser-facing WebSocket URL of the LiveKit server
|   (wss://rapat.example.co.id; locally wss://livekit.test via Herd proxy).
| - api_url: server-to-server HTTP base for the Room Service API (mute,
|   remove). Defaults to `url` with ws→http; locally http://127.0.0.1:7880.
| - api_key / api_secret: a key pair from livekit.yaml `keys:`. The same pair
|   signs webhooks (livekit.yaml `webhook.api_key`).
|
*/

return [
    'url' => env('LIVEKIT_URL'),
    'api_url' => env('LIVEKIT_API_URL'),
    'api_key' => env('LIVEKIT_API_KEY'),
    'api_secret' => env('LIVEKIT_API_SECRET'),

    // Access tokens are short-lived; the server refreshes them while
    // connected and the room page asks for a new one on reconnect.
    'token_ttl' => (int) env('LIVEKIT_TOKEN_TTL', 600),

    // Join window: from N minutes before the start until N minutes after
    // the end. The organizer may open the room at any time.
    'join_before_minutes' => (int) env('LIVEKIT_JOIN_BEFORE_MINUTES', 15),
    'join_after_minutes' => (int) env('LIVEKIT_JOIN_AFTER_MINUTES', 120),

    // Live subtitles in the room (stage 2: GPU transcription worker sends
    // LiveKit text streams on topic `lk.transcription`). Only a flag for the
    // UI (docs/fitur/rapat-video-kontrak.md §1.1 features.subtitles).
    'subtitles' => (bool) env('LIVEKIT_SUBTITLES', false),

    // "Waktu bicara" (meeting_speaking_times) is deleted together with the
    // transcripts of the automatic minutes: same retention, in days
    // (PruneSpeakingTimes, daily). meeting_attendances are kept.
    'speaking_retention_days' => (int) env('MINUTES_TRANSCRIPT_RETENTION_DAYS', 90),

    // Webhooks older than this (event createdAt / token nbf) are rejected.
    'webhook_tolerance' => (int) env('LIVEKIT_WEBHOOK_TOLERANCE', 300),
];
