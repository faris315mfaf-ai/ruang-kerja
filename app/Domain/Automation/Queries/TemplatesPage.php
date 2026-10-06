<?php

namespace App\Domain\Automation\Queries;

use App\Domain\Automation\Services\TemplateShapes;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Policies\TaskTemplatePolicy;
use App\Policies\WorkspacePolicy;

/**
 * Props of /otomasi/template (features/automation/types.ts TemplatesProps):
 * company-wide task templates plus those of the user's workspaces, the
 * company's workspace templates, and the rights the dialogs need.
 */
final class TemplatesPage
{
    public function __construct(
        private readonly AutomationWorkspaces $workspaces,
        private readonly TaskTemplatePolicy $taskTemplates,
        private readonly WorkspacePolicy $workspacePolicy,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $options = $this->workspaces->for($user);
        $manageable = collect($options['workspaces'])->where('can_manage', true)->pluck('id')->flip();
        $superAdmin = $user->hasPermission(Permission::WorkspacesManage);

        $taskTemplates = TaskTemplate::query()
            ->visibleTo($user)
            ->orderByDesc('used_count')
            ->orderBy('name')
            ->get()
            ->map(fn (TaskTemplate $template): array => [
                'id' => $template->id,
                'workspace_id' => $template->workspace_id,
                'name' => $template->name,
                'description' => $template->description ?? '',
                'title' => $template->title,
                'priority' => $template->priority->value,
                'estimate_hours' => $template->estimate_hours === null ? null : (float) $template->estimate_hours,
                'checklist' => TemplateShapes::checklist($template->checklist),
                'labels' => TemplateShapes::labelRefs($template->labels),
                'used_count' => $template->used_count,
                'can_manage' => $template->workspace_id !== null
                    ? $manageable->has($template->workspace_id)
                    : ($template->created_by === $user->id || $superAdmin),
            ])
            ->values()
            ->all();

        $types = array_values(array_filter(
            [WorkspaceType::Team, WorkspaceType::Project],
            fn (WorkspaceType $type): bool => $this->workspacePolicy->create($user, $type),
        ));

        $workspaceTemplates = WorkspaceTemplate::query()
            ->visibleTo($user)
            ->orderByDesc('used_count')
            ->orderBy('name')
            ->get()
            ->map(fn (WorkspaceTemplate $template): array => [
                'id' => $template->id,
                'name' => $template->name,
                'description' => $template->description ?? '',
                'type' => $template->type->value,
                'statuses' => TemplateShapes::statuses($template->statuses),
                'labels' => TemplateShapes::labelRefs($template->labels),
                'used_count' => $template->used_count,
                'can_use' => in_array($template->type, $types, true),
                'can_delete' => $template->created_by === $user->id || $superAdmin,
            ])
            ->values()
            ->all();

        return [
            'workspaces' => $options['workspaces'],
            'task_templates' => $taskTemplates,
            'workspace_templates' => $workspaceTemplates,
            'can_create_company_template' => $this->taskTemplates->canCreateCompanyWide($user),
            'workspace_types' => array_map(fn (WorkspaceType $type): string => $type->value, $types),
        ];
    }
}
