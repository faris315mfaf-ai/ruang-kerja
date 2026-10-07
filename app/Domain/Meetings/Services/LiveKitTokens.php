<?php

namespace App\Domain\Meetings\Services;

use Carbon\CarbonImmutable;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use stdClass;
use Throwable;

/**
 * LiveKit JWTs (HS256 with the API secret, docs.livekit.io "Tokens & grants"):
 *
 * - access tokens for one participant in one room: iss = API key, sub =
 *   identity, name, nbf/exp, `video` grant, optional `metadata` (JSON
 *   string) and `attributes`;
 * - short admin tokens for the Room Service API (roomAdmin for one room);
 * - verification of webhook requests: the Authorization header holds a JWT
 *   signed with the same pair whose `sha256` claim is base64(SHA-256(body)).
 */
final class LiveKitTokens
{
    private const string ALGORITHM = 'HS256';

    public function __construct(private readonly VideoRooms $rooms) {}

    /**
     * @param  array<string, bool|string>  $grant  video grant (room, roomJoin, canPublish, …)
     * @param  array<string, mixed>|null  $metadata
     * @param  array<string, string>  $attributes
     */
    public function accessToken(
        string $identity,
        string $name,
        array $grant,
        int $ttlSeconds,
        ?array $metadata = null,
        array $attributes = [],
        ?CarbonImmutable $now = null,
    ): string {
        $now ??= CarbonImmutable::now();
        $claims = [
            'iss' => $this->rooms->apiKey(),
            'sub' => $identity,
            'name' => $name,
            'nbf' => $now->getTimestamp() - 10,
            'exp' => $now->getTimestamp() + $ttlSeconds,
            'jti' => $identity.'-'.bin2hex(random_bytes(6)),
            'video' => $grant,
        ];

        if ($metadata !== null) {
            $claims['metadata'] = (string) json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        if ($attributes !== []) {
            $claims['attributes'] = $attributes;
        }

        return JWT::encode($claims, $this->rooms->apiSecret(), self::ALGORITHM);
    }

    /** Room Service API token for one room (mute, remove, list participants). */
    public function adminToken(string $room, ?CarbonImmutable $now = null): string
    {
        $now ??= CarbonImmutable::now();

        return JWT::encode([
            'iss' => $this->rooms->apiKey(),
            'nbf' => $now->getTimestamp() - 10,
            'exp' => $now->getTimestamp() + 60,
            'video' => ['room' => $room, 'roomAdmin' => true, 'roomList' => true],
        ], $this->rooms->apiSecret(), self::ALGORITHM);
    }

    /**
     * Claims of a valid webhook signature, or null. The header may carry the
     * token bare (LiveKit) or with a "Bearer " prefix.
     */
    public function verifyWebhook(string $body, ?string $authorization): ?stdClass
    {
        $token = trim((string) preg_replace('/^Bearer\s+/i', '', (string) $authorization));

        if ($token === '' || ! $this->rooms->configured()) {
            return null;
        }

        // exp/nbf are checked against the app clock (Carbon, travel-aware in tests).
        [$previous, $leeway] = [JWT::$timestamp, JWT::$leeway];
        JWT::$timestamp = CarbonImmutable::now()->getTimestamp();
        JWT::$leeway = 10;

        try {
            $claims = JWT::decode($token, new Key($this->rooms->apiSecret(), self::ALGORITHM));
        } catch (Throwable) {
            return null;
        } finally {
            [JWT::$timestamp, JWT::$leeway] = [$previous, $leeway];
        }

        $sha = $claims->sha256 ?? null;

        if (($claims->iss ?? null) !== $this->rooms->apiKey() || ! is_string($sha)) {
            return null;
        }

        $expected = base64_encode(hash('sha256', $body, true));

        // LiveKit uses standard base64; accept the URL-safe/unpadded variant too.
        $normalized = rtrim(strtr($sha, '-_', '+/'), '=');

        return hash_equals(rtrim($expected, '='), $normalized) ? $claims : null;
    }
}
