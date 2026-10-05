<?php

namespace App\Domain\Projects\Queries;

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Models\Division;
use App\Models\User;
use App\Models\Workspace;

/**
 * Props of Pengaturan › Proyek: current attributes and the choices
 * (sponsor = Direksi, divisi utama, status). PIC candidates are the members.
 */
final class ProjectSettings
{
    /**
     * @return array<string, mixed>|null null for non-project workspaces
     */
    public function props(Workspace $workspace): ?array
    {
        if (! $workspace->isProject()) {
            return null;
        }

        return [
            'attributes' => [
                'lead_user_id' => $workspace->lead_user_id,
                'sponsor_user_id' => $workspace->sponsor_user_id,
                'division_id' => $workspace->division_id,
                'start_date' => $workspace->start_date?->toDateString(),
                'target_date' => $workspace->target_date?->toDateString(),
                'project_status' => ProjectMetrics::status($workspace)->value,
            ],
            'sponsor_options' => array_values(User::query()
                ->active()
                ->where('company_id', $workspace->company_id)
                ->role(Role::Direksi->value)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (User $user): array => ['value' => $user->id, 'label' => $user->name])
                ->all()),
            'division_options' => array_values(Division::query()
                ->where('company_id', $workspace->company_id)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Division $division): array => ['value' => $division->id, 'label' => $division->name])
                ->all()),
            'status_options' => array_map(fn (ProjectStatus $status): array => ['value' => $status->value, 'label' => $status->label()], ProjectStatus::cases()),
        ];
    }
}
