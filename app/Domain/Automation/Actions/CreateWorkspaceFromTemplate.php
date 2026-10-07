<?php

namespace App\Domain\Automation\Actions;

use App\Domain\Automation\Services\TemplateShapes;
use App\Domain\Tasks\Actions\SaveLabel;
use App\Domain\Tasks\Services\Lexorank;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * "Pakai template" (workspace): creates the workspace through CreateWorkspace
 * (owner membership, activity, Drive folder) with the template's type, then
 * replaces the five default columns with the template's columns and adds its
 * labels. The key was validated by WorkspaceFromTemplateRequest
 * (`^[A-Z][A-Z0-9]{1,9}$`, unique including previous keys); CreateWorkspace
 * still falls back to a free key if another workspace took it meanwhile.
 */
final class CreateWorkspaceFromTemplate
{
    public function __construct(
        private readonly CreateWorkspace $createWorkspace,
        private readonly SaveLabel $saveLabel,
    ) {}

    /**
     * @param  array{name: string, key: string, visibility: WorkspaceVisibility, description?: string|null}  $input
     */
    public function handle(WorkspaceTemplate $template, User $actor, array $input): Workspace
    {
        return DB::transaction(function () use ($template, $actor, $input): Workspace {
            $workspace = $this->createWorkspace->handle($actor, [
                'type' => $template->type,
                'name' => $input['name'],
                'key' => $input['key'],
                'visibility' => $input['visibility'],
                'description' => $input['description'] ?? null,
            ]);

            $statuses = TemplateShapes::statuses($template->statuses);

            // A brand-new workspace has no tasks: its default columns can go.
            if ($statuses !== []) {
                TaskStatus::query()->where('workspace_id', $workspace->id)->delete();
                $positions = Lexorank::sequence(count($statuses));

                foreach ($statuses as $index => $status) {
                    TaskStatus::query()->create([
                        'workspace_id' => $workspace->id,
                        'name' => Str::limit($status['name'], 60, ''),
                        'category' => $status['category'],
                        'color' => $status['color'],
                        'position' => $positions[$index],
                    ]);
                }
            }

            foreach (TemplateShapes::labels($template->labels) as $label) {
                $this->saveLabel->handle($workspace, Str::limit($label['name'], 50, ''), $label['color']);
            }

            WorkspaceTemplate::query()->whereKey($template->id)->increment('used_count');

            return $workspace;
        });
    }
}
