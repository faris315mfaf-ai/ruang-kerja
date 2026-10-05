<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\ActivityEvent;
use App\Events\Tasks\TaskUpdated;
use App\Models\ChecklistItem;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Renames and/or ticks a checklist line. Ticking records done_by/done_at and
 * the activity "menyelesaikan 'Hero section'".
 */
final class UpdateChecklistItem
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    /**
     * @param  array{title?: string, is_done?: bool}  $changes
     */
    public function handle(ChecklistItem $item, User $actor, array $changes): ChecklistItem
    {
        /** @var Task $task */
        $task = $item->task()->with('workspace')->firstOrFail();

        DB::transaction(function () use ($item, $actor, $changes, $task): void {
            if (array_key_exists('title', $changes)) {
                $item->title = trim($changes['title']);
            }

            $completed = false;

            if (array_key_exists('is_done', $changes) && $changes['is_done'] !== $item->is_done) {
                $item->is_done = $changes['is_done'];
                $item->done_by = $item->is_done ? $actor->id : null;
                $item->done_at = $item->is_done ? now() : null;
                $completed = $item->is_done;
            }

            $item->save();

            if ($completed) {
                $this->recordActivity->handle($task->workspace, $task, $actor, ActivityEvent::ChecklistItemCompleted, [
                    'key' => $task->displayKey(),
                    'title' => $task->title,
                    'item' => $item->title,
                ]);
            }
        });

        $task->touch();
        TaskUpdated::dispatch($task);

        return $item;
    }
}
