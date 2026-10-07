<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\RoomEvents;
use App\Models\MeetingMinutes;
use App\Models\MeetingMinuteVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Autosave of a draft (attendance, notes per agenda item, decisions). Saves
 * that change nothing are ignored. A change is kept as a version: a new
 * snapshot, unless the latest snapshot is the same author's and younger than
 * five minutes — then that one is refreshed (at most one version per person
 * per five minutes while typing).
 */
final class SaveMinutes
{
    public const int VERSION_WINDOW_MINUTES = 5;

    public function __construct(
        private readonly MinutesStore $store,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @param  array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}  $content
     */
    public function handle(Occurrence $occurrence, User $actor, array $content): MeetingMinutes
    {
        return DB::transaction(function () use ($occurrence, $actor, $content): MeetingMinutes {
            $minutes = $this->store->open($occurrence);

            if ($minutes->isFinal()) {
                throw ValidationException::withMessages(['minutes' => 'Notulen sudah final. Buka kembali draf untuk mengubahnya.']);
            }

            $normalized = self::normalize($content);

            // == (not ===): jsonb returns object keys in its own order.
            if ($normalized == $minutes->content()) {
                return $minutes;
            }

            $minutes->fill([...$normalized, 'updated_by' => $actor->id])->save();
            $this->snapshot($minutes, $actor, force: false);
            // Video room "Notulen Hidup": others refetch (sent after commit).
            $this->events->minutesChanged($minutes, $occurrence->meeting);

            return $minutes;
        });
    }

    /**
     * Records the current content as a version (FinalizeMinutes: force).
     */
    public function snapshot(MeetingMinutes $minutes, User $actor, bool $force): void
    {
        $latest = MeetingMinuteVersion::query()->where('minutes_id', $minutes->id)->latest('created_at')->latest('id')->first();

        if (! $force && $latest !== null && $latest->created_by === $actor->id
            && $latest->created_at !== null && $latest->created_at->gt(now()->subMinutes(self::VERSION_WINDOW_MINUTES))) {
            $latest->forceFill(['content' => $minutes->content()])->save();

            return;
        }

        MeetingMinuteVersion::query()->create([
            'minutes_id' => $minutes->id,
            'content' => $minutes->content(),
            'created_by' => $actor->id,
        ]);
        $minutes->forceFill(['version' => $minutes->version + 1])->save();
    }

    /**
     * @param  array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}  $content
     * @return array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}
     */
    public static function normalize(array $content): array
    {
        $attendance = [];
        $seen = [];

        foreach ($content['attendance'] as $mark) {
            $id = (string) $mark['user_id'];

            if (isset($seen[$id])) {
                continue;
            }

            $seen[$id] = true;
            $reason = isset($mark['reason']) ? trim((string) $mark['reason']) : '';
            $present = (bool) $mark['present'];
            $attendance[] = $present || $reason === ''
                ? ['user_id' => $id, 'present' => $present]
                : ['user_id' => $id, 'present' => false, 'reason' => $reason];
        }

        $sections = array_map(fn (array $section): array => [
            'title' => trim((string) $section['title']),
            'body' => rtrim((string) $section['body']),
        ], $content['sections']);

        $decisions = array_values(array_filter(
            array_map(fn (mixed $decision): string => trim((string) $decision), $content['decisions']),
            fn (string $decision): bool => $decision !== '',
        ));

        return ['attendance' => $attendance, 'sections' => $sections, 'decisions' => $decisions];
    }
}
