<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

/**
 * "Panggil" bookkeeping per occurrence and called person: the rate limit
 * (one call per DECAY_SECONDS) and the time of the last call shown in the
 * Kehadiran panel ("Dipanggil 09.12"). Kept in the cache only (the audit log
 * holds the permanent record).
 */
final class MeetingCalls
{
    public const int DECAY_SECONDS = 60;

    private const int REMEMBER_SECONDS = 6 * 3600;

    /**
     * Claims the call slot; null when allowed, else the seconds to wait.
     */
    public function claim(Occurrence $occurrence, string $userId): ?int
    {
        $key = $this->limiterKey($occurrence, $userId);

        if (RateLimiter::tooManyAttempts($key, 1)) {
            return max(1, RateLimiter::availableIn($key));
        }

        RateLimiter::hit($key, self::DECAY_SECONDS);

        return null;
    }

    public function remember(Occurrence $occurrence, string $userId, CarbonImmutable $at): void
    {
        Cache::put($this->calledKey($occurrence, $userId), $at->toIso8601ZuluString(), self::REMEMBER_SECONDS);
    }

    /**
     * Last call per person (ISO time), for the given ids (one cache round trip).
     *
     * @param  list<string>  $userIds
     * @return array<string, string>
     */
    public function lastCalls(Occurrence $occurrence, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $keys = [];

        foreach ($userIds as $id) {
            $keys[$this->calledKey($occurrence, $id)] = $id;
        }

        $result = [];

        foreach (Cache::many(array_keys($keys)) as $key => $value) {
            if (is_string($value)) {
                $result[$keys[$key]] = $value;
            }
        }

        return $result;
    }

    private function limiterKey(Occurrence $occurrence, string $userId): string
    {
        return 'meeting-call:'.$occurrence->meeting->id.':'.$occurrence->date.':'.$userId;
    }

    private function calledKey(Occurrence $occurrence, string $userId): string
    {
        return 'meeting-called:'.$occurrence->meeting->id.':'.$occurrence->date.':'.$userId;
    }
}
