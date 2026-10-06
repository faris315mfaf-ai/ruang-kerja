<?php

namespace App\Domain\Notes\Services;

use App\Models\Note;
use App\Models\User;

/**
 * Short-lived token for the collab server (collab/src/token.js verifies the
 * same format): base64url(JSON payload) . "." . base64url(HMAC-SHA256).
 * Payload: note id, user id, display name, edit right, expiry (unix). The
 * secret (COLLAB_SECRET) is shared with the collab server only.
 */
final class CollabToken
{
    public static function enabled(): bool
    {
        return self::secret() !== '';
    }

    public function issue(Note $note, User $user, bool $canEdit): string
    {
        $payload = [
            'note' => $note->id,
            'user' => $user->id,
            'name' => $user->name,
            'edit' => $canEdit,
            'exp' => now()->addSeconds(self::ttl())->getTimestamp(),
        ];

        $body = self::base64Url((string) json_encode($payload));

        return $body.'.'.self::base64Url(hash_hmac('sha256', $body, self::secret(), true));
    }

    /**
     * Payload of a valid, unexpired token (null otherwise). The collab server
     * has its own implementation; this one documents and tests the format.
     *
     * @return array{note: string, user: string, name: string, edit: bool, exp: int}|null
     */
    public function verify(string $token): ?array
    {
        $parts = explode('.', $token);

        if (count($parts) !== 2 || ! self::enabled()) {
            return null;
        }

        [$body, $signature] = $parts;
        $expected = self::base64Url(hash_hmac('sha256', $body, self::secret(), true));

        if (! hash_equals($expected, $signature)) {
            return null;
        }

        $payload = json_decode((string) base64_decode(strtr($body, '-_', '+/'), true), true);

        if (! is_array($payload)
            || ! is_string($payload['note'] ?? null)
            || ! is_string($payload['user'] ?? null)
            || ! is_string($payload['name'] ?? null)
            || ! is_bool($payload['edit'] ?? null)
            || ! is_int($payload['exp'] ?? null)
            || $payload['exp'] < now()->getTimestamp()) {
            return null;
        }

        return [
            'note' => $payload['note'],
            'user' => $payload['user'],
            'name' => $payload['name'],
            'edit' => $payload['edit'],
            'exp' => $payload['exp'],
        ];
    }

    public static function ttl(): int
    {
        return max(10, config()->integer('collab.token_ttl', 120));
    }

    private static function secret(): string
    {
        return (string) config('collab.secret', '');
    }

    private static function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
