<?php

namespace App\Http\Controllers\Api\Automation;

use App\Domain\Automation\Actions\ApplyTaskTemplate;
use App\Domain\Automation\Services\TemplateShapes;
use App\Http\Controllers\Controller;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Task templates on the phone (behind features.automation, 404 while off).
 * `GET /otomasi/templat/tugas` lists the templates the caller can see
 * (company-wide ones plus those of the workspaces they belong to) and
 * `POST /workspace/{workspace}/tugas-dari-templat` is "Pakai template": the
 * web ApplyTaskTemplate action behind TaskTemplatePolicy::use (member who
 * may create tasks in the workspace, template of that workspace or
 * company-wide). Creating and editing templates stays on the desktop.
 */
class TaskTemplateController extends Controller
{
    public function index(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', TaskTemplate::class);

        $templates = TaskTemplate::query()
            ->visibleTo($user)
            ->with('workspace:id,company_id,key,name,type,owner_id,archived_at')
            ->orderByDesc('used_count')
            ->orderBy('name')
            ->get();

        return response()->json(['templat' => $templates->map(fn (TaskTemplate $template): array => [
            'id' => $template->id,
            'name' => $template->name,
            'description' => $template->description ?? '',
            'title' => $template->title,
            'priority' => $template->priority->value,
            'priority_label' => $template->priority->label(),
            'estimate_hours' => $template->estimate_hours === null ? null : (float) $template->estimate_hours,
            'checklist' => TemplateShapes::checklist($template->checklist),
            'labels' => TemplateShapes::labelRefs($template->labels),
            'used_count' => $template->used_count,
            'scope' => $template->workspace === null ? 'semua' : 'workspace',
            'workspace' => $template->workspace === null ? null : [
                'id' => $template->workspace->id,
                'key' => $template->workspace->key,
                'name' => $template->workspace->name,
            ],
        ])->values()->all()]);
    }

    /**
     * POST /workspace/{workspace}/tugas-dari-templat — 201 with the new task.
     */
    public function apply(Request $request, Workspace $workspace, #[CurrentUser] User $user, ApplyTaskTemplate $apply): JsonResponse
    {
        $data = $request->validate([
            'template_id' => ['required', 'string', 'ulid'],
            'title' => ['required', 'string', 'max:255'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
        ], [
            'template_id.required' => 'Pilih template.',
            'template_id.ulid' => 'Template tidak valid.',
            'title.required' => 'Isi judul tugas.',
            'title.max' => 'Judul maksimal 255 karakter.',
            'due_date.date_format' => 'Tanggal tenggat tidak valid.',
        ]);

        $template = TaskTemplate::query()->visibleTo($user)->find(strtolower($data['template_id']));
        abort_if($template === null, 404);

        Gate::authorize('use', [$template, $workspace]);

        ['task' => $task, 'skipped_labels' => $skipped] = $apply->handle($template, $workspace, $user, [
            'title' => trim($data['title']),
            'due_date' => ! empty($data['due_date']) ? $data['due_date'] : null,
        ]);

        $message = "Tugas {$task->displayKey()} dibuat dari template \"{$template->name}\".";

        if ($skipped !== []) {
            $message .= ' Label '.implode(', ', $skipped).' tidak ada di workspace ini dan dilewati.';
        }

        return response()->json([
            'task' => [
                'id' => $task->id,
                'key' => $task->displayKey(),
                'title' => $task->title,
                'workspace' => ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name],
                'priority' => ['value' => $task->priority->value, 'label' => $task->priority->label()],
                'due_date' => $task->due_date?->toDateString(),
            ],
            'skipped_labels' => $skipped,
            'message' => $message,
        ], 201);
    }
}
