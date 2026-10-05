<?php

namespace App\Domain\Tasks\Services;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;

/**
 * Prepares an incoming Tiptap document of a task description or comment:
 * resolves @mentions to people who can see the workspace and #references to
 * tasks the author can see, then sanitizes (RichText).
 */
final class TaskRichText
{
    public function __construct(
        private readonly MentionParser $parser,
        private readonly TaskAudience $audience,
    ) {}

    /**
     * @param  array<mixed>|null  $document
     * @return array{document: array<string, mixed>|null, text: string|null, mentioned_ids: list<string>}
     */
    public function prepare(Workspace $workspace, User $author, ?array $document): array
    {
        if ($document === null) {
            return ['document' => null, 'text' => null, 'mentioned_ids' => []];
        }

        $people = $this->audience->withAccess($workspace, $this->parser->userIds($document))
            ->mapWithKeys(fn (User $user): array => [$user->id => $user->name])
            ->all();

        $taskIds = $this->parser->taskIds($document);
        $tasks = $taskIds === [] ? [] : Task::query()
            ->visibleTo($author)
            ->whereIn('tasks.id', $taskIds)
            ->with('workspace:id,key')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number'])
            ->mapWithKeys(fn (Task $task): array => [$task->id => $task->displayKey()])
            ->all();

        $clean = RichText::sanitize($document, $people, $tasks);

        return [
            'document' => $clean,
            'text' => RichText::toText($clean),
            'mentioned_ids' => $this->parser->userIds($clean),
        ];
    }
}
