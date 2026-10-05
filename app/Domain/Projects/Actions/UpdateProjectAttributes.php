<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Pengaturan › Proyek: PIC, sponsor, divisi utama, tanggal mulai, target,
 * status siklus. Completing a project stamps completed_at. Recorded in the
 * workspace feed and audit_logs (PIC/sponsor changes are sensitive).
 */
final class UpdateProjectAttributes
{
    public const array FIELDS = ['lead_user_id', 'sponsor_user_id', 'division_id', 'start_date', 'target_date', 'project_status'];

    public function __construct(
        private readonly RecordActivity $recordActivity,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{lead_user_id?: string|null, sponsor_user_id?: string|null, division_id?: string|null, start_date?: string|null, target_date?: string|null, project_status?: ProjectStatus}  $attributes
     */
    public function handle(Workspace $workspace, User $actor, array $attributes): Workspace
    {
        return DB::transaction(function () use ($workspace, $actor, $attributes): Workspace {
            $workspace->fill(array_intersect_key($attributes, array_flip(self::FIELDS)));

            if ($workspace->isDirty('project_status')) {
                $workspace->completed_at = $workspace->project_status === ProjectStatus::Completed ? now() : null;
            }

            $dirty = array_intersect_key($workspace->getDirty(), array_flip([...self::FIELDS, 'completed_at']));

            if ($dirty === []) {
                return $workspace;
            }

            $original = array_intersect_key($workspace->getOriginal(), $dirty);
            $workspace->save();

            $from = self::scalars($original);
            $to = self::scalars(array_intersect_key($workspace->getAttributes(), $dirty));

            $this->recordActivity->handle($workspace, $workspace, $actor, ActivityEvent::ProjectAttributesChanged, ['from' => $from, 'to' => $to]);
            $this->audit->log('project.attributes_changed', $workspace, $from, $to, $actor);

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
            fn (mixed $value): string|int|float|bool|null => match (true) {
                $value instanceof \BackedEnum => $value->value,
                $value instanceof \DateTimeInterface => $value->format('Y-m-d'),
                is_scalar($value), $value === null => $value,
                default => null,
            },
            $values,
        );
    }
}
