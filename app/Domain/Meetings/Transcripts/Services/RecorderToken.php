<?php

namespace App\Domain\Meetings\Transcripts\Services;

use App\Domain\Meetings\Services\VideoRooms;
use Carbon\CarbonImmutable;
use Firebase\JWT\JWT;

/**
 * LiveKit access token for the hidden recorder (docs.livekit.io "Tokens &
 * grants"): identity rk-notulen, kind "agent" (does not keep an empty room
 * open), hidden (other participants never see it), subscribe only — no
 * publish, no data, no metadata changes. Short-lived; LiveKit refreshes it
 * while the worker stays connected.
 */
final class RecorderToken
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly NotulenConfig $config,
    ) {}

    public function for(string $room, ?CarbonImmutable $now = null): string
    {
        $now ??= CarbonImmutable::now();
        $identity = $this->config->identity();

        return JWT::encode([
            'iss' => $this->rooms->apiKey(),
            'sub' => $identity,
            'name' => 'Notulen otomatis',
            'kind' => 'agent',
            'nbf' => $now->getTimestamp() - 10,
            'exp' => $now->getTimestamp() + max(60, (int) config('notulen.transcriber.token_ttl', 600)),
            'jti' => $identity.'-'.bin2hex(random_bytes(6)),
            'video' => [
                'room' => $room,
                'roomJoin' => true,
                'canSubscribe' => true,
                'canPublish' => false,
                'canPublishData' => false,
                'canUpdateOwnMetadata' => false,
                'hidden' => true,
            ],
        ], $this->rooms->apiSecret(), 'HS256');
    }
}
