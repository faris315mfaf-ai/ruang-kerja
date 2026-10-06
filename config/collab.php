<?php

/*
|--------------------------------------------------------------------------
| Collab server (Catatan bersama, F2-2)
|--------------------------------------------------------------------------
|
| Hocuspocus (Yjs) server in collab/ (docs/fitur/catatan.md). Laravel issues
| short-lived tokens for it (GET /catatan/{note}/token) and serves its
| internal state endpoints (/internal/catatan/*), both signed with the shared
| COLLAB_SECRET. Without a secret the notes work in "save without
| collaboration" mode.
|
*/

return [
    // Shared secret between Laravel and the collab server (min. 32 chars).
    'secret' => (string) env('COLLAB_SECRET', ''),

    // Laravel → collab server (internal HTTP), e.g. http://collab:1234 in Docker.
    'url' => env('COLLAB_URL', 'http://127.0.0.1:'.env('COLLAB_PORT', 1234)),

    // Browser → collab server (WebSocket), e.g. wss://kantor.example/collab.
    'public_url' => env('VITE_COLLAB_URL', 'ws://127.0.0.1:'.env('COLLAB_PORT', 1234)),

    // Lifetime of the connection token in seconds (the provider asks again on reconnect).
    'token_ttl' => (int) env('COLLAB_TOKEN_TTL', 120),
];
