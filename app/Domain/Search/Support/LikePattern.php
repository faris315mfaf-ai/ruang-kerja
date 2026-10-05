<?php

namespace App\Domain\Search\Support;

/**
 * Builds a safe "%term%" pattern for (I)LIKE: escapes %, _ and \ so user
 * input is matched literally (PostgreSQL's default escape character is \).
 */
final class LikePattern
{
    public static function contains(string $term): string
    {
        return '%'.addcslashes($term, '\\%_').'%';
    }
}
