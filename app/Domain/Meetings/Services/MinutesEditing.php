<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * "X sedang menyunting" hint of the minutes without collaboration (single
 * editor, last write wins; docs/fitur/rapat-video-kontrak.md §1.4). The
 * editor's browser sends a heartbeat while the document has focus; the
 * first active editor holds the hint for TTL_SECONDS after their last
 * heartbeat. It never blocks a save. Changes are broadcast as
 * minutes.editing.
 */
final class MinutesEditing
{
    public const int TTL_SECONDS = 30;

    public function __construct(private readonly RoomEvents $events) {}

    /**
     * @return array{user_id: string, name: string, since: string, expires_at: string}|null
     */
    public function current(Occurrence $occurrence, ?CarbonImmutable $now = null): ?array
    {
        $now ??= CarbonImmutable::now();
        $holder = Cache::get($this->key($occurrence));

        if (! is_array($holder) || ! is_string($holder['expires_at'] ?? null) || CarbonImmutable::parse($holder['expires_at'])->lte($now)) {
            return null;
        }

        /** @var array{user_id: string, name: string, since: string, expires_at: string} $holder */
        return $holder;
    }

    /**
     * Heartbeat (active) or release (not active). Returns who holds the hint now.
     *
     * @return array{user_id: string, name: string, since: string, expires_at: string}|null
     */
    public function heartbeat(Occurrence $occurrence, User $user, bool $active, ?CarbonImmutable $now = null): ?array
    {
        $now ??= CarbonImmutable::now();
        $holder = $this->current($occurrence, $now);
        $mine = $holder !== null && $holder['user_id'] === $user->id;

        if (! $active) {
            if ($mine) {
                Cache::forget($this->key($occurrence));
                $this->events->minutesEditing($occurrence, null);
            }

            return $mine ? null : $holder;
        }

        if ($holder !== null && ! $mine) {
            return $holder;
        }

        $next = [
            'user_id' => $user->id,
            'name' => $user->name,
            'since' => $mine ? $holder['since'] : $now->toIso8601ZuluString(),
            'expires_at' => $now->addSeconds(self::TTL_SECONDS)->toIso8601ZuluString(),
        ];
        Cache::put($this->key($occurrence), $next, self::TTL_SECONDS + 5);

        if (! $mine) {
            $this->events->minutesEditing($occurrence, $next);
        }

        return $next;
    }

    private function key(Occurrence $occurrence): string
    {
        return 'meeting-minutes-editing:'.$occurrence->meeting->id.':'.$occurrence->date;
    }
}
