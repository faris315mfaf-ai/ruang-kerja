<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\InboxNotification;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Retention ("Notifikasi disimpan 30 hari"): deletes notifications older than
 * notifications.retention_days, keeping unresolved "Perlu tindakan" items.
 *
 * Unresolved "Perlu tindakan" items whose subject no longer exists (deleted
 * or soft-deleted record) can never be acted on: they are resolved first, so
 * they leave "Perlu tindakan" now and are pruned once past retention. Reminder
 * claims (`notification_dispatch_logs`) of vanished subjects are deleted.
 */
final class PruneNotifications
{
    /**
     * @return int number of deleted notifications
     */
    public function handle(CarbonInterface $now): int
    {
        $this->resolveOrphans($now);
        $this->forgetOrphanedClaims();

        $cutoff = $now->copy()->subDays(config()->integer('notifications.retention_days', 30));

        return InboxNotification::query()
            ->where('created_at', '<', $cutoff)
            ->where(fn ($query) => $query
                ->where('action_required', false)
                ->orWhereNotNull('resolved_at'))
            ->delete();
    }

    /**
     * @return int number of orphaned items resolved
     */
    private function resolveOrphans(CarbonInterface $now): int
    {
        $resolved = 0;

        $types = InboxNotification::query()
            ->where('action_required', true)
            ->whereNull('resolved_at')
            ->whereNotNull('subject_type')
            ->distinct()
            ->pluck('subject_type');

        foreach ($types as $type) {
            $subjectGone = self::subjectGone((string) $type, 'notifications.subject_id');

            if ($subjectGone === null) {
                continue;
            }

            $resolved += InboxNotification::query()
                ->where('action_required', true)
                ->whereNull('resolved_at')
                ->where('subject_type', $type)
                ->whereNotExists($subjectGone)
                ->update(['resolved_at' => $now, 'updated_at' => $now]);
        }

        return $resolved;
    }

    private function forgetOrphanedClaims(): void
    {
        $table = NotificationDispatchLog::TABLE;

        foreach (DB::table($table)->distinct()->pluck('subject_type') as $type) {
            $subjectGone = self::subjectGone((string) $type, $table.'.subject_id');

            if ($subjectGone !== null) {
                DB::table($table)->where('subject_type', $type)->whereNotExists($subjectGone)->delete();
            }
        }
    }

    /**
     * "The live subject row" subquery for a NOT EXISTS (soft-deleted rows count
     * as gone), or null when the morph type is unknown.
     *
     * @return (Closure(QueryBuilder): void)|null
     */
    private static function subjectGone(string $type, string $subjectIdColumn): ?Closure
    {
        $class = Relation::getMorphedModel($type) ?? $type;

        if (! is_a($class, Model::class, true)) {
            return null;
        }

        $model = new $class;
        $softDeletes = in_array(SoftDeletes::class, class_uses_recursive($class), true);

        return function (QueryBuilder $query) use ($model, $softDeletes, $subjectIdColumn): void {
            $query->selectRaw('1')
                ->from($model->getTable())
                ->whereColumn($model->getQualifiedKeyName(), $subjectIdColumn);

            if ($softDeletes) {
                $query->whereNull($model->qualifyColumn('deleted_at'));
            }
        };
    }
}
