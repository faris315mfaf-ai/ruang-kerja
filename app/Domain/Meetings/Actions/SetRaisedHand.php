<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Raise / lower one's own hand in the video room. Clients cannot change
 * their own attributes (no canUpdateOwnMetadata, audit R-05), so the server
 * sets the participant attribute `hand` = raise time in ms ("" = lowered;
 * the room orders hands by it). Throws RuntimeException when LiveKit fails.
 */
final class SetRaisedHand
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitRoomService $service,
    ) {}

    public function handle(User $user, Occurrence $occurrence, bool $raised, ?CarbonImmutable $now = null): string
    {
        $value = $raised ? (string) ($now ?? CarbonImmutable::now())->getTimestampMs() : '';

        $this->service->updateAttributes($this->rooms->roomName($occurrence), $user->id, ['hand' => $value]);

        return $value;
    }
}
