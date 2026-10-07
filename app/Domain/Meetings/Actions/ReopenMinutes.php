<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\MinutesStatus;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "Buka kembali draf" (organizer): unlocks final minutes for editing and
 * writes `meeting.minutes_reopened` to audit_logs. Idempotent.
 */
final class ReopenMinutes
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RoomEvents $events,
    ) {}

    public function handle(MeetingMinutes $minutes, User $actor): MeetingMinutes
    {
        return DB::transaction(function () use ($minutes, $actor): MeetingMinutes {
            $locked = MeetingMinutes::query()->lockForUpdate()->findOrFail($minutes->id);

            if (! $locked->isFinal()) {
                return $locked;
            }

            $finalizedAt = $locked->finalized_at?->toIso8601String();

            $locked->forceFill([
                'status' => MinutesStatus::Draft,
                'finalized_at' => null,
                'finalized_by' => null,
                'updated_by' => $actor->id,
            ])->save();

            $this->audit->log('meeting.minutes_reopened', $locked, [
                'status' => MinutesStatus::Final->value,
                'finalized_at' => $finalizedAt,
            ], ['status' => MinutesStatus::Draft->value], $actor);
            $this->events->minutesChanged($locked);

            return $locked;
        });
    }
}
