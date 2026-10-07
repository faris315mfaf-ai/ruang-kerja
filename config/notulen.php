<?php

/*
|--------------------------------------------------------------------------
| Notulen otomatis (Video RuangKerja, tahap 1)
|--------------------------------------------------------------------------
|
| After-meeting transcription + AI draft minutes for meetings with
| `auto_minutes` (docs/fitur/notulen-otomatis-kontrak.md; deploy guide
| docs/deploy/RAPAT-VIDEO.md §7–§8; worker files transcriber/DEPLOY.md).
| The worker (transcriber/, Python) runs next to LiveKit on the meeting server; the app asks it to join a room and
| receives the transcript back. Both directions are HMAC-signed with
| TRANSCRIBER_SECRET (App\Domain\Meetings\Transcripts\Services\NotulenSignature).
|
| - transcriber.url empty → the feature is unavailable (toggle hidden).
| - llm.api_key empty → transcripts are still stored, no AI draft is made.
|   The provider is any OpenAI-compatible chat completions API; the default
|   DeepSeek processes the transcript outside Indonesia (privacy policy).
|
*/

return [
    'transcriber' => [
        // Base URL of the worker API, e.g. https://livekit.spkd.store/notulen
        'url' => rtrim((string) env('TRANSCRIBER_URL', ''), '/'),
        'secret' => (string) env('TRANSCRIBER_SECRET', ''),
        'timeout' => (int) env('TRANSCRIBER_TIMEOUT', 10),
        // Signed requests older/newer than this (seconds) are refused.
        'tolerance' => (int) env('TRANSCRIBER_TOLERANCE', 300),
        // Largest transcript body accepted from the worker.
        'max_body_bytes' => (int) env('TRANSCRIBER_MAX_BODY', 5 * 1024 * 1024),
        // Identity of the hidden recorder participant in LiveKit.
        'identity' => 'rk-notulen',
        // Lifetime of the recorder's LiveKit token (LiveKit refreshes it while connected).
        'token_ttl' => (int) env('TRANSCRIBER_TOKEN_TTL', 600),
    ],

    'llm' => [
        'base_url' => rtrim((string) env('MINUTES_LLM_BASE_URL', 'https://api.deepseek.com'), '/'),
        'api_key' => (string) env('MINUTES_LLM_API_KEY', ''),
        'model' => (string) env('MINUTES_LLM_MODEL', 'deepseek-chat'),
        // Shown in the UI and the privacy text.
        'provider' => (string) env('MINUTES_LLM_PROVIDER', 'DeepSeek'),
        'outside_indonesia' => (bool) env('MINUTES_LLM_OUTSIDE_INDONESIA', true),
        'timeout' => (int) env('MINUTES_LLM_TIMEOUT', 120),
        'retries' => (int) env('MINUTES_LLM_RETRIES', 2),
        // Transcript characters per request; longer meetings are summarized map-reduce.
        'chunk_chars' => (int) env('MINUTES_LLM_CHUNK_CHARS', 40000),
        'max_tokens' => (int) env('MINUTES_LLM_MAX_TOKENS', 4000),
    ],

    // Transcripts (and their AI drafts) are deleted this many days after the meeting.
    // Text moved into the minutes with "Masukkan ke notulen" stays with the minutes.
    'retention_days' => (int) env('MINUTES_TRANSCRIPT_RETENTION_DAYS', 90),
];
