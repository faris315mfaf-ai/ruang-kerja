<?php

namespace App\Domain\Automation\Actions;

use App\Models\Company;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;

/**
 * Creates (or updates) a task template: company-wide when $workspace is null.
 * Input validated by TaskTemplateRequest (estimate 0,5–999 hours).
 */
final class SaveTaskTemplate
{
    /**
     * @param  array{name: string, description: string|null, title: string, priority: int, estimate_hours: float|null, checklist: list<string>, labels: list<array{name: string, color: string}>}  $data
     */
    public function handle(User $actor, ?Workspace $workspace, array $data, ?TaskTemplate $template = null): TaskTemplate
    {
        $template ??= new TaskTemplate(['created_by' => $actor->id]);

        $template->fill([
            'company_id' => $workspace !== null ? $workspace->company_id : ($actor->company_id ?? Company::query()->value('id')),
            'workspace_id' => $workspace?->id,
            'name' => trim($data['name']),
            'description' => $data['description'] !== null && trim($data['description']) !== '' ? trim($data['description']) : null,
            'title' => trim($data['title']),
            'priority' => $data['priority'],
            'estimate_hours' => $data['estimate_hours'],
            'checklist' => $data['checklist'],
            'labels' => $data['labels'],
        ]);
        $template->save();

        return $template;
    }
}
