<?php

namespace App\Domain\Automation\Actions;

use App\Domain\Automation\Services\AutomationAccess;
use App\Domain\Automation\Services\TemplateShapes;
use App\Domain\Tasks\Actions\AddChecklistItem;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\SaveLabel;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * "Pakai template" (task): creates the task through CreateTask with the
 * template's priority and estimate, the chosen title and due date, its
 * labels (matched by name in $workspace; a missing label is created when
 * the actor manages the workspace, otherwise skipped and reported) and its
 * checklist lines (AddChecklistItem). Counts the use.
 */
final class ApplyTaskTemplate
{
    public function __construct(
        private readonly CreateTask $createTask,
        private readonly AddChecklistItem $addChecklistItem,
        private readonly SaveLabel $saveLabel,
        private readonly AutomationAccess $access,
    ) {}

    /**
     * @param  array{title: string, due_date: string|null}  $input
     * @return array{task: Task, skipped_labels: list<string>}
     */
    public function handle(TaskTemplate $template, Workspace $workspace, User $actor, array $input): array
    {
        return DB::transaction(function () use ($template, $workspace, $actor, $input): array {
            [$labelIds, $skipped] = $this->labels($template, $workspace, $actor);

            $task = $this->createTask->handle($workspace, $actor, [
                'title' => $input['title'],
                'priority' => $template->priority,
                'estimate_hours' => $template->estimate_hours,
                'due_date' => $input['due_date'],
                'label_ids' => $labelIds,
            ]);

            foreach (TemplateShapes::checklist($template->checklist) as $line) {
                $this->addChecklistItem->handle($task, Str::limit($line, 255, ''));
            }

            TaskTemplate::query()->whereKey($template->id)->increment('used_count');

            return ['task' => $task, 'skipped_labels' => $skipped];
        });
    }

    /**
     * @return array{0: list<string>, 1: list<string>} [label ids, skipped names]
     */
    private function labels(TaskTemplate $template, Workspace $workspace, User $actor): array
    {
        $wanted = TemplateShapes::labels($template->labels);

        if ($wanted === []) {
            return [[], []];
        }

        $existing = Label::query()
            ->where('workspace_id', $workspace->id)
            ->get()
            ->keyBy(fn (Label $label): string => mb_strtolower($label->name));
        $canCreate = $this->access->canManage($actor, $workspace);
        $ids = [];
        $skipped = [];

        foreach ($wanted as $label) {
            $name = $label['name'];
            $found = $existing->get(mb_strtolower($name));

            if ($found !== null) {
                $ids[] = $found->id;
            } elseif ($canCreate) {
                $ids[] = $this->saveLabel->handle($workspace, Str::limit($name, 50, ''), $label['color'])->id;
            } else {
                $skipped[] = $name;
            }
        }

        return [$ids, $skipped];
    }
}
