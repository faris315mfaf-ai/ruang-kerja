<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\User;
use Illuminate\Contracts\Support\Arrayable;
use JsonSerializable;

/**
 * Optional link to the automatic minutes backend (agent notulen,
 * docs/fitur/notulen-otomatis-kontrak.md §3): the `notulen` prop of the
 * pre-join and room pages is its NotulenSummary when that class exists in
 * this build, else null. Keeps the room working before that branch is
 * merged (and if it is ever removed).
 */
final class NotulenBridge
{
    public const string SUMMARY_CLASS = 'App\\Domain\\Meetings\\Transcripts\\Queries\\NotulenSummary';

    /**
     * @return array<string, mixed>|null
     */
    public function summary(Occurrence $occurrence, User $viewer): ?array
    {
        $class = self::SUMMARY_CLASS;

        if (! class_exists($class)) {
            return null;
        }

        $summary = app($class);

        if (! is_object($summary) || ! method_exists($summary, 'for')) {
            return null;
        }

        $result = $summary->for($occurrence, $viewer);

        if ($result instanceof Arrayable) {
            $result = $result->toArray();
        } elseif ($result instanceof JsonSerializable) {
            $result = $result->jsonSerialize();
        }

        /** @var array<string, mixed>|null $array */
        $array = is_array($result) ? $result : null;

        return $array;
    }

    /**
     * "Notulen otomatis aktif" for the room (available and switched on).
     *
     * @param  array<string, mixed>|null  $summary
     */
    public static function autoMinutes(?array $summary): bool
    {
        return $summary !== null && ($summary['available'] ?? false) === true && ($summary['auto_minutes'] ?? false) === true;
    }
}
