<?php

namespace App\Domain\Meetings\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * LiveKit Room Service API (Twirp over HTTP + JSON,
 * POST {api_url}/twirp/livekit.RoomService/{Method}) with a short admin
 * token for the room. Used synchronously by the organizer's moderation
 * buttons (5 s timeout); failures surface as RuntimeException.
 */
final class LiveKitRoomService
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitTokens $tokens,
    ) {}

    public function mutePublishedTrack(string $room, string $identity, string $trackSid, bool $muted = true): void
    {
        $this->call('MutePublishedTrack', $room, [
            'room' => $room,
            'identity' => $identity,
            'track_sid' => $trackSid,
            'muted' => $muted,
        ]);
    }

    public function removeParticipant(string $room, string $identity): void
    {
        $this->call('RemoveParticipant', $room, ['room' => $room, 'identity' => $identity]);
    }

    /**
     * Sets participant attributes server-side (clients have no
     * canUpdateOwnMetadata, audit R-05). An empty value deletes the key.
     *
     * @param  array<string, string>  $attributes
     */
    public function updateAttributes(string $room, string $identity, array $attributes): void
    {
        $this->call('UpdateParticipant', $room, ['room' => $room, 'identity' => $identity, 'attributes' => $attributes]);
    }

    /** Ends the room for everyone (meeting canceled, audit R-09). */
    public function deleteRoom(string $room): void
    {
        $this->call('DeleteRoom', $room, ['room' => $room]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listParticipants(string $room): array
    {
        $response = $this->call('ListParticipants', $room, ['room' => $room]);
        $participants = $response['participants'] ?? [];

        return is_array($participants) ? array_values(array_filter($participants, is_array(...))) : [];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function call(string $method, string $room, array $payload): array
    {
        if (! $this->rooms->configured()) {
            throw new RuntimeException('LiveKit is not configured.');
        }

        try {
            $response = Http::timeout(5)
                ->acceptJson()
                ->withToken($this->tokens->adminToken($room))
                ->post($this->rooms->apiUrl().'/twirp/livekit.RoomService/'.$method, $payload)
                ->throw();
        } catch (ConnectionException|RequestException $exception) {
            throw new RuntimeException("LiveKit {$method} failed: ".$exception->getMessage(), 0, $exception);
        }

        $json = $response->json();

        return is_array($json) ? $json : [];
    }
}
