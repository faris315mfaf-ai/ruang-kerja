<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * General settings: name, key (old key kept for redirects), description,
 * visibility and color. Personal workspaces stay private; Ruang HR system
 * workspaces also keep their key.
 */
final class UpdateWorkspace
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    /**
     * @param  array{name?: string, key?: string, description?: string|null, visibility?: WorkspaceVisibility, color?: string|null}  $changes
     */
    public function handle(Workspace $workspace, User $actor, array $changes): Workspace
    {
        return DB::transaction(function () use ($workspace, $actor, $changes): Workspace {
            $workspace->fill(array_intersect_key($changes, array_flip(['name', 'description', 'visibility', 'color'])));

            if ($workspace->isPersonal() || $workspace->isSystem()) {
                $workspace->visibility = WorkspaceVisibility::Private;
            }

            // Ruang HR system workspaces keep their key (links from Ruang HR).
            if ($workspace->isSystem()) {
                unset($changes['key']);
            }

            if (isset($changes['key']) && $changes['key'] !== $workspace->key) {
                $previous = array_values(array_filter(
                    $workspace->previous_keys,
                    fn (string $key): bool => $key !== $changes['key'],
                ));
                $previous[] = $workspace->key;
                $workspace->previous_keys = array_values(array_unique($previous));
                $workspace->key = $changes['key'];
            }

            $dirty = $workspace->getDirty();

            if ($dirty === []) {
                return $workspace;
            }

            $original = array_intersect_key($workspace->getOriginal(), $dirty);
            $workspace->save();

            unset($dirty['previous_keys'], $original['previous_keys']);

            $this->recordActivity->handle($workspace, $workspace, $actor, ActivityEvent::WorkspaceUpdated, [
                'from' => self::scalars($original),
                'to' => self::scalars($dirty),
            ]);

            return $workspace;
        });
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, scalar|null>
     */
    private static function scalars(array $values): array
    {
        return array_map(
            fn (mixed $value): string|int|float|bool|null => $value instanceof \BackedEnum ? $value->value : (is_scalar($value) || $value === null ? $value : null),
            $values,
        );
    }
}
