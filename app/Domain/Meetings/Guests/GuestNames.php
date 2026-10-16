<?php

namespace App\Domain\Meetings\Guests;

/**
 * The name a guest types (or the organizer pre-fills). It ends up in the
 * LiveKit token as "Nama (Tamu)", on screen for everybody, so it is plain text:
 * tags and control characters removed, whitespace collapsed, 2-60 characters.
 */
final class GuestNames
{
    public const int MAX = 60;

    public const string SUFFIX = ' (Tamu)';

    public static function clean(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $text = strip_tags($value);
        $text = (string) preg_replace('/[\p{C}\p{Zl}\p{Zp}]+/u', ' ', $text);
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));
        // A guest cannot pass as the "(Tamu)" marker itself.
        $text = trim(str_ireplace('(Tamu)', '', $text));

        return mb_strlen($text) >= 2 ? mb_substr($text, 0, self::MAX) : null;
    }

    /** Display name signed into the LiveKit token. */
    public static function display(?string $name): string
    {
        return $name !== null && $name !== '' ? $name.self::SUFFIX : 'Tamu';
    }
}
