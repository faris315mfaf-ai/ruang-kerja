<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Raw binary <-> PostgreSQL `bytea`. PDO binds strings as text, which
 * rejects NUL bytes, so values are written in the hex input format
 * (`\x0a1b…`); reads come back as a stream (pdo_pgsql) or a hex string.
 *
 * @implements CastsAttributes<string|null, string|null>
 */
final class PostgresBytea implements CastsAttributes
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_resource($value)) {
            $value = stream_get_contents($value);

            if ($value === false) {
                return null;
            }
        }

        $value = (string) $value;

        if (str_starts_with($value, '\\x')) {
            $binary = hex2bin(substr($value, 2));

            return $binary === false ? null : $binary;
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return '\\x'.bin2hex((string) $value);
    }
}
