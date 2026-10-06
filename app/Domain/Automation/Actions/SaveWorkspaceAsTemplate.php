<?php

namespace App\Domain\Automation\Actions;

use App\Models\Label;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;

/**
 * "Simpan sebagai template" (Pengaturan workspace): copies the columns (name,
 * category, colour, in board order) and labels of a team/project workspace
 * into a company-wide workspace template. Tasks and members are not copied.
 */
final class SaveWorkspaceAsTemplate
{
    /**
     * @param  array{name: string, description: string|null}  $input
     */
    public function handle(Workspace $source, User $actor, array $input): WorkspaceTemplate
    {
        $statuses = TaskStatus::query()
            ->where('workspace_id', $source->id)
            ->orderBy('position')
            ->get(['name', 'category', 'color'])
            ->map(fn (TaskStatus $status): array => [
                'name' => $status->name,
                'category' => $status->category->value,
                'color' => $status->color,
            ])
            ->values()
            ->all();

        $labels = Label::query()
            ->where('workspace_id', $source->id)
            ->orderBy('name')
            ->get(['name', 'color'])
            ->map(fn (Label $label): array => ['name' => $label->name, 'color' => $label->color])
            ->values()
            ->all();

        return WorkspaceTemplate::query()->create([
            'company_id' => $source->company_id,
            'name' => trim($input['name']),
            'description' => $input['description'] !== null && trim($input['description']) !== '' ? trim($input['description']) : null,
            'type' => $source->type,
            'statuses' => $statuses,
            'labels' => $labels,
            'source_workspace_id' => $source->id,
            'created_by' => $actor->id,
        ]);
    }
}
