<?php

namespace App\Domain\Notifications\Actions;

use App\Models\InboxNotification;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Retention ("Notifikasi disimpan 30 hari"): deletes notifications older than
 * notifications.retention_days, keeping unresolved "Perlu tindakan" items.
 *
 * Unresolved "Perlu tindakan" items whose subject no longer exists (deleted
 * or soft-deleted record) can never be acted on: they are resolved first, so
 * they leave "Perlu tindakan" now and are pruned once past retention.
 */
final class PruneNotifications
{
    /**
     * @return int number of deleted notifications
     */
    public function handle(CarbonInterface $now): int
    {
        $this->resolveOrphans($now);

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
            $class = Relation::getMorphedModel((string) $type) ?? (string) $type;

            if (! is_a($class, Model::class, true)) {
                continue;
            }

            /** @var Model $model */
            $model = new $class;
            $softDeletes = in_array(SoftDeletes::class, class_uses_recursive($class), true);

            $resolved += InboxNotification::query()
                ->where('action_required', true)
                ->whereNull('resolved_at')
                ->where('subject_type', $type)
                ->whereNotExists(function (QueryBuilder $query) use ($model, $softDeletes): void {
                    $query->selectRaw('1')
                        ->from($model->getTable())
                        ->whereColumn($model->getQualifiedKeyName(), 'notifications.subject_id');

                    if ($softDeletes) {
                        $query->whereNull($model->qualifyColumn('deleted_at'));
                    }
                })
                ->update(['resolved_at' => $now, 'updated_at' => $now]);
        }

        return $resolved;
    }
}
