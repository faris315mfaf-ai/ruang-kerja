<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Sets whitelisted LiveKit attributes of one's own participant through the
 * server, since tokens no longer carry canUpdateOwnMetadata (audit R-05: a
 * client could rename itself). Allowed keys and values (ATTRIBUTES): raised
 * hand, the minutes section one is looking at (collaborator presence), and
 * the transcription opt-out mirror (the consent table stays the source of
 * truth). Empty value = remove. Throws RuntimeException when LiveKit fails.
 */
final class SetOwnAttributes
{
    /** key => value pattern (an empty string is always allowed). */
    public const array ATTRIBUTES = [
        'hand' => '/^\d{10,16}$/',
        'rk_minutes_at' => '/^[A-Za-z0-9_.:-]{1,64}$/',
        'rk_notulen_optout' => '/^[01]$/',
    ];

    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitRoomService $service,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, string>
     */
    public function handle(User $user, Occurrence $occurrence, array $attributes): array
    {
        $clean = [];

        foreach ($attributes as $key => $value) {
            // "" arrives as null (ConvertEmptyStringsToNull): it means "remove".
            $value = $value === null ? '' : (is_scalar($value) ? (string) $value : null);
            $pattern = self::ATTRIBUTES[$key] ?? null;

            if ($pattern === null || $value === null || ($value !== '' && preg_match($pattern, $value) !== 1)) {
                throw ValidationException::withMessages(['attributes' => "Atribut {$key} tidak diizinkan."]);
            }

            // The raise time orders the hands: always the server's clock, never the
            // client's (audit rapat 2026-10, B-03), like SetRaisedHand.
            if ($key === 'hand' && $value !== '') {
                $value = (string) CarbonImmutable::now()->getTimestampMs();
            }

            $clean[(string) $key] = $value;
        }

        if ($clean === []) {
            throw ValidationException::withMessages(['attributes' => 'Tidak ada atribut.']);
        }

        $this->service->updateAttributes($this->rooms->roomName($occurrence), $user->id, $clean);

        return $clean;
    }
}
