<?php

namespace App\Http\Controllers\Automation;

use App\Domain\Automation\Actions\CreateWorkspaceFromTemplate;
use App\Domain\Automation\Actions\DeleteWorkspaceTemplate;
use App\Domain\Automation\Actions\SaveWorkspaceAsTemplate;
use App\Domain\Automation\Services\TemplateShapes;
use App\Http\Controllers\Controller;
use App\Http\Requests\Automation\SaveWorkspaceTemplateRequest;
use App\Http\Requests\Automation\WorkspaceFromTemplateRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Workspace templates: "Simpan sebagai template" (Pengaturan workspace),
 * "Pakai template" (creates the workspace and opens it), delete.
 */
class WorkspaceTemplateController extends Controller
{
    public function store(SaveWorkspaceTemplateRequest $request, string $source, #[CurrentUser] User $user, SaveWorkspaceAsTemplate $save): RedirectResponse
    {
        $workspace = Workspace::query()->where('company_id', $user->company_id)->findOrFail($source);
        Gate::authorize('create', [WorkspaceTemplate::class, $workspace]);

        $template = $save->handle($workspace, $user, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Template \"{$template->name}\" disimpan. Pakai dari Otomasi › Template."]);

        return back();
    }

    public function apply(WorkspaceFromTemplateRequest $request, WorkspaceTemplate $template, #[CurrentUser] User $user, CreateWorkspaceFromTemplate $create): RedirectResponse
    {
        Gate::authorize('use', $template);

        $workspace = $create->handle($template, $user, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Workspace {$workspace->key} dibuat dengan ".count(TemplateShapes::statuses($template->statuses)).' kolom dari template.']);

        return to_route('workspaces.show', $workspace);
    }

    public function destroy(WorkspaceTemplate $template, DeleteWorkspaceTemplate $delete): RedirectResponse
    {
        Gate::authorize('delete', $template);

        $delete->handle($template);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Template \"{$template->name}\" dihapus."]);

        return back();
    }
}
