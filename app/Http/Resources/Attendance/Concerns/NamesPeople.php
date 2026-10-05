<?php

namespace App\Http\Resources\Attendance\Concerns;

use Illuminate\Support\Str;

/**
 * Avatar initials for attendance lists ("Sari Wulandari" → "SW").
 */
trait NamesPeople
{
    public static function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $first = $parts[0] ?? '';
        $last = count($parts) > 1 ? (string) end($parts) : '';

        return Str::upper(mb_substr($first, 0, 1).mb_substr($last, 0, 1));
    }
}
