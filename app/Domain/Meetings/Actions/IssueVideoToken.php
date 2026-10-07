<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\LiveKitTokens;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * LiveKit access token for one person in the room of one occurrence
 * (POST /rapat/{meeting}/video/token). Authorization (MeetingPolicy::joinVideo)
 * happens before. Identity = user ULID, so webhooks map back to the person.
 * Nobody gets `roomAdmin` in the browser (audit rapat 2026-10, R-03): with it
 * a client could call the Room Service API directly (remove, rename, mute)
 * without MeetingPolicy or audit; the organizer moderates through the app
 * (LiveKitRoomService, server-side admin token). Everyone may publish camera,
 * mic, screen and data (chat). No `canUpdateOwnMetadata` (audit R-05): it
 * would let a client rename itself ("Direktur Utama") or change its
 * metadata; the raised hand is set by the server (SetRaisedHand).
 */
final class IssueVideoToken
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitTokens $tokens,
    ) {}

    /**
     * @return array{url: string, token: string, room: string, identity: string, name: string, expires_at: string}
     */
    public function handle(User $user, Occurrence $occurrence, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $organizer = $occurrence->meeting->organizer_id === $user->id;
        $room = $this->rooms->roomName($occurrence);
        $ttl = max(60, (int) config('livekit.token_ttl', 600));
        $avatar = $user->getAttribute('avatar_url');

        $grant = [
            'room' => $room,
            'roomJoin' => true,
            'canPublish' => true,
            'canSubscribe' => true,
            'canPublishData' => true,
        ];

        $token = $this->tokens->accessToken(
            identity: $user->id,
            name: $user->name,
            grant: $grant,
            ttlSeconds: $ttl,
            metadata: ['avatar_url' => is_string($avatar) ? $avatar : null, 'organizer' => $organizer],
            now: $now,
        );

        return [
            'url' => $this->rooms->url(),
            'token' => $token,
            'room' => $room,
            'identity' => $user->id,
            'name' => $user->name,
            'expires_at' => $now->addSeconds($ttl)->toIso8601ZuluString(),
        ];
    }
}
