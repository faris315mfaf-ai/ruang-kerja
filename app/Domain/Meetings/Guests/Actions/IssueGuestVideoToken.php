<?php

namespace App\Domain\Meetings\Guests\Actions;

use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Guests\GuestAccessException;
use App\Domain\Meetings\Guests\GuestNames;
use App\Domain\Meetings\Guests\Services\GuestAccess;
use App\Domain\Meetings\Services\LiveKitTokens;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingParticipant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * LiveKit access token for an ADMITTED external guest (POST /api/tamu/{token}/token).
 *
 * - identity `guest:{participant id}` — never a user id, so the attendance
 *   webhook, transcripts and moderation can tell guests apart;
 * - name `Nama (Tamu)`, signed into the token: the marker cannot be removed by
 *   the guest (no canUpdateOwnMetadata, so it cannot be renamed in the room);
 * - grants: roomJoin, publish (camera, mic, screen), subscribe and data
 *   (meeting chat). Never roomAdmin: the Room Service API stays server-side;
 * - the TTL is short (livekit.token_ttl); the guest page asks again on
 *   reconnect, which is refused once the guest was removed or the window ended.
 *
 * Audit `meeting.guest_joined` once per admission (first token).
 */
final class IssueGuestVideoToken
{
    public const string IDENTITY_PREFIX = 'guest:';

    public function __construct(
        private readonly GuestAccess $access,
        private readonly VideoRooms $rooms,
        private readonly LiveKitTokens $tokens,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @return array{url: string, token: string, room: string, identity: string, name: string, expires_at: string, occurrence_date: string}
     *
     * @throws GuestAccessException
     */
    public function handle(MeetingParticipant $guest, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $state = $this->access->inspect($guest, $now);

        if ($state->status === 'closed') {
            throw GuestAccessException::closed();
        }

        if ($state->status === 'expired') {
            throw GuestAccessException::expired();
        }

        $occurrence = $state->occurrence;

        if ($occurrence === null || $state->status !== LobbyStatus::Admitted->value) {
            throw GuestAccessException::notAdmitted($state->status);
        }

        $room = $this->rooms->roomName($occurrence);
        $identity = self::identity($guest);
        $name = GuestNames::display($guest->guest_name);
        $ttl = max(60, (int) config('livekit.token_ttl', 600));

        $token = $this->tokens->accessToken(
            identity: $identity,
            name: $name,
            grant: [
                'room' => $room,
                'roomJoin' => true,
                'canPublish' => true,
                'canSubscribe' => true,
                'canPublishData' => true,
            ],
            ttlSeconds: $ttl,
            metadata: ['guest' => true, 'avatar_url' => null, 'organizer' => false],
            now: $now,
        );

        DB::transaction(function () use ($guest, $occurrence, $now): void {
            /** @var MeetingParticipant $row */
            $row = MeetingParticipant::query()->whereKey($guest->id)->lockForUpdate()->firstOrFail();

            if ($row->joined_at !== null) {
                return;
            }

            $row->forceFill(['joined_at' => $now])->save();
            $this->audit->log('meeting.guest_joined', $guest->meeting, null, [
                'participant_id' => $row->id,
                'occurrence_date' => $occurrence->date,
                'guest_name' => $row->guest_name,
            ], null);
        });

        return [
            'url' => $this->rooms->url(),
            'token' => $token,
            'room' => $room,
            'identity' => $identity,
            'name' => $name,
            'expires_at' => $now->addSeconds($ttl)->toIso8601ZuluString(),
            'occurrence_date' => $occurrence->date,
        ];
    }

    public static function identity(MeetingParticipant $guest): string
    {
        return self::IDENTITY_PREFIX.strtolower((string) $guest->id);
    }

    /** The participant ULID behind a `guest:*` identity, or null. */
    public static function participantId(string $identity): ?string
    {
        if (preg_match('/^guest:([0-9a-hjkmnp-tv-z]{26})$/i', $identity, $match) !== 1) {
            return null;
        }

        return strtolower($match[1]);
    }
}
