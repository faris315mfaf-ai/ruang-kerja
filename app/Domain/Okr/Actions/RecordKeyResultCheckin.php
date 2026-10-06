<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Services\ObjectiveHealth;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Weekly check-in of a key result: appends a key_result_checkins row (office
 * date) and sets key_results.current_value in one transaction (row lock on
 * the key result so concurrent check-ins apply in order). A status drop of
 * the objective notifies its owner and Kepala Divisi.
 */
final class RecordKeyResultCheckin
{
    public function __construct(
        private readonly ObjectiveHealth $health,
        private readonly NotifyObjectiveAtRisk $atRisk,
    ) {}

    public function handle(KeyResult $keyResult, User $author, float $value, ?int $confidence, ?string $note): KeyResultCheckin
    {
        $objective = $keyResult->objective;
        $before = $this->health->statusOf($objective);

        $checkin = DB::transaction(function () use ($keyResult, $author, $value, $confidence, $note, $objective): KeyResultCheckin {
            KeyResult::query()->whereKey($keyResult->id)->lockForUpdate()->first();

            $checkin = KeyResultCheckin::query()->create([
                'key_result_id' => $keyResult->id,
                'value' => $value,
                'confidence' => $confidence,
                'note' => $note !== null && trim($note) !== '' ? trim($note) : null,
                'author_id' => $author->id,
                'checked_on' => OfficeTime::todayString(),
            ]);

            $keyResult->forceFill(['current_value' => $value])->save();
            $objective->touch();

            return $checkin;
        });

        $this->atRisk->handle($objective, $before, $author);

        return $checkin;
    }
}
