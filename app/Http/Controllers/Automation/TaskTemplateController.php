<?php

namespace App\Http\Controllers\Automation;

use App\Domain\Automation\Actions\ApplyTaskTemplate;
use App\Domain\Automation\Actions\DeleteTaskTemplate;
use App\Domain\Automation\Actions\SaveTaskTemplate;
use App\Domain\Automation\Queries\TemplatesPage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Automation\ApplyTaskTemplateRequest;
use App\Http\Requests\Automation\TaskTemplateRequest;
use App\Models\TaskTemplate;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /otomasi/template — task templates (and the page of both template kinds).
 */
class TaskTemplateController extends Controller
{
    public function index(#[CurrentUser] User $user, TemplatesPage $page): Response
    {
        Gate::authorize('viewAny', TaskTemplate::class);

        return Inertia::render('automation/templates', [
            'templates' => $page->for($user),
        ]);
    }

    public function store(TaskTemplateRequest $request, #[CurrentUser] User $user, SaveTaskTemplate $save): RedirectResponse
    {
        $workspace = $request->workspace();
        Gate::authorize('create', [TaskTemplate::class, $workspace]);

        $template = $save->handle($user, $workspace, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Template \"{$template->name}\" disimpan."]);

        return back();
    }

    public function update(TaskTemplateRequest $request, TaskTemplate $template, #[CurrentUser] User $user, SaveTaskTemplate $save): RedirectResponse
    {
        Gate::authorize('update', $template);
        $workspace = $request->workspace();

        if ($workspace?->id !== $template->workspace_id) {
            Gate::authorize('create', [TaskTemplate::class, $workspace]);
        }

        $save->handle($user, $workspace, $request->payload(), $template);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Template diperbarui.']);

        return back();
    }

    public function destroy(TaskTemplate $template, DeleteTaskTemplate $delete): RedirectResponse
    {
        Gate::authorize('delete', $template);

        $delete->handle($template);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Template \"{$template->name}\" dihapus."]);

        return back();
    }

    /** "Pakai template": creates the task, then stays on the page with a toast. */
    public function apply(ApplyTaskTemplateRequest $request, TaskTemplate $template, #[CurrentUser] User $user, ApplyTaskTemplate $apply): RedirectResponse
    {
        $workspace = $request->workspace();
        Gate::authorize('use', [$template, $workspace]);

        ['task' => $task, 'skipped_labels' => $skipped] = $apply->handle($template, $workspace, $user, $request->payload());

        $message = "Tugas {$task->displayKey()} dibuat dari template \"{$template->name}\".";

        if ($skipped !== []) {
            $message .= ' Label '.implode(', ', $skipped).' tidak ada di workspace ini dan dilewati.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
