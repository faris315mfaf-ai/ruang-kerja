<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Casts a PostgreSQL `text[]` column to list<string> and back.
 *
 * @implements CastsAttributes<list<string>, iterable<string>|null>
 */
final class PostgresTextArray implements CastsAttributes
{
    /**
     * @param  array<string, mixed>  $attributes
     * @return list<string>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_map('strval', $value));
        }

        return self::parse((string) $value);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        if ($value === null) {
            return '{}';
        }

        $items = [];

        foreach ($value as $item) {
            $items[] = '"'.addcslashes((string) $item, '"\\').'"';
        }

        return '{'.implode(',', $items).'}';
    }

    /**
     * Parses a Postgres array literal such as {a,"b c","d\"e"}.
     *
     * @return list<string>
     */
    public static function parse(string $literal): array
    {
        $literal = trim($literal);

        if ($literal === '{}' || strlen($literal) < 2) {
            return [];
        }

        $body = substr($literal, 1, -1);
        $items = [];
        $current = '';
        $quoted = false;
        $wasQuoted = false;
        $length = strlen($body);

        for ($i = 0; $i < $length; $i++) {
            $char = $body[$i];

            if ($quoted) {
                if ($char === '\\' && $i + 1 < $length) {
                    $current .= $body[++$i];
                } elseif ($char === '"') {
                    $quoted = false;
                } else {
                    $current .= $char;
                }

                continue;
            }

            if ($char === '"') {
                $quoted = true;
                $wasQuoted = true;
            } elseif ($char === ',') {
                $items[] = $current;
                $current = '';
                $wasQuoted = false;
            } else {
                $current .= $char;
            }
        }

        if ($current !== '' || $wasQuoted) {
            $items[] = $current;
        }

        return $items;
    }
}
