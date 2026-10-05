<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Dashboard cache (Sprint 9)
    |--------------------------------------------------------------------------
    |
    | Metric blocks of the dashboards are cached per viewer + filter for this
    | many seconds (PROMPTS Sprint 9: 5 minutes). Live blocks (today's
    | attendance, approval queue) are never cached. `store` null = the default
    | cache store (Redis in local/production, array in tests).
    |
    */

    'cache_ttl' => (int) env('ANALYTICS_CACHE_TTL', 300),

    'cache_store' => env('ANALYTICS_CACHE_STORE'),

    /*
    | A project workspace counts as "at risk" when its PIC health is at_risk /
    | off_track or its last project update is older than this many days
    | (PRD M10 "Update kedaluwarsa").
    */
    'stale_update_days' => 7,

    /* Longest custom period (days). */
    'max_custom_days' => 366,
];
