<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Automation\Services\TemplateShapes;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Policies\WorkspacePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/templat — workspace templates of the company for the
 * "Workspace baru" sheet (use them with POST /workspace + template_id).
 * Behind features.automation like the web template pages. `can_use` mirrors
 * WorkspaceTemplatePolicy::use (whoever may create that workspace type).
 */
class WorkspaceTemplateController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, WorkspacePolicy $policy): JsonResponse
    {
        Gate::authorize('viewAny', WorkspaceTemplate::class);

        $allowed = [];
        foreach ([WorkspaceType::Team, WorkspaceType::Project] as $type) {
            $allowed[$type->value] = $policy->create($user, $type);
        }

        $templates = WorkspaceTemplate::query()
            ->visibleTo($user)
            ->orderByDesc('used_count')
            ->orderBy('name')
            ->get()
            ->map(fn (WorkspaceTemplate $template): array => [
                'id' => $template->id,
                'name' => $template->name,
                'description' => $template->description ?? '',
                'type' => $template->type->value,
                'type_label' => $template->type->label(),
                'statuses' => TemplateShapes::statuses($template->statuses),
                'labels' => TemplateShapes::labelRefs($template->labels),
                'used_count' => $template->used_count,
                'can_use' => $allowed[$template->type->value] ?? false,
            ])
            ->values()
            ->all();

        return response()->json(['templat' => $templates]);
    }
}
