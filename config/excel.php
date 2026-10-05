<?php

use App\Support\Excel\SafeValueBinder;

/*
 * Only the keys that differ from maatwebsite/excel's defaults (merged with
 * the package config by its service provider).
 */
return [
    'value_binder' => [
        // Strings starting with = + - @ tab/CR are written as text, never as formulas.
        'default' => SafeValueBinder::class,
    ],
];
