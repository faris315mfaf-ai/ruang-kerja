<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * `notification_dispatch_logs`: channel-independent record that a scheduled
 * reminder was sent for (type, subject, recipient, cycle) — e.g. "overdue" for
 * a task and its due date. claim() is atomic (unique index + INSERT … ON
 * CONFLICT DO NOTHING), so concurrent runs send once; release() is called when
 * the reminder is settled so a later cycle may remind again.
 */
final class NotificationDispatchLog
{
    public const string TABLE = 'notification_dispatch_logs';

    /**
     * @return bool true when this call claimed the slot (send now)
     */
    public function claim(User $user, NotificationType $type, Model $subject, string $cycle): bool
    {
        return DB::table(self::TABLE)->insertOrIgnore([
            'id' => (string) Str::ulid(),
            'type' => $type->value,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => self::key($subject),
            'user_id' => $user->id,
            'cycle' => $cycle,
            'created_at' => now(),
        ]) === 1;
    }

    /**
     * Forgets the claims of the subjects (ids or a subquery of ids) of one type
     * (null = every type), optionally only for some recipients.
     *
     * @param  list<string>|Builder  $subjectIds
     * @param  list<string>|null  $userIds
     */
    public function release(?NotificationType $type, string $subjectType, array|Builder $subjectIds, ?array $userIds = null): int
    {
        return DB::table(self::TABLE)
            ->when($type !== null, fn (Builder $query) => $query->where('type', $type?->value))
            ->where('subject_type', $subjectType)
            ->whereIn('subject_id', $subjectIds)
            ->when($userIds !== null, fn (Builder $query) => $query->whereIn('user_id', $userIds ?? []))
            ->delete();
    }

    private static function key(Model $subject): string
    {
        $key = $subject->getKey();

        return is_scalar($key) ? (string) $key : '';
    }
}
