<?php

namespace App\Domain\Chat\Services;

use App\Domain\Tasks\Services\MentionParser;
use App\Domain\Tasks\Services\RichText;
use App\Models\Channel;
use App\Models\Task;
use App\Models\User;

/**
 * Message body (Tiptap JSON from the composer) → sanitized document. Like
 * TaskRichText: mentions survive only for people who can read the channel
 * (ChannelAudience), `#KEY-n` references only for tasks the author can see;
 * everything else becomes plain text.
 */
final class ChatRichText
{
    public function __construct(
        private readonly MentionParser $parser,
        private readonly ChannelAudience $audience,
    ) {}

    /**
     * @param  array<mixed>|null  $document
     * @return array{document: array<string, mixed>|null, text: string, mentioned_ids: list<string>}
     */
    public function prepare(Channel $channel, User $author, ?array $document): array
    {
        if ($document === null) {
            return ['document' => null, 'text' => '', 'mentioned_ids' => []];
        }

        $people = $this->audience->withAccess($channel, $this->parser->userIds($document))
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
            'text' => RichText::toText($clean) ?? '',
            'mentioned_ids' => $this->parser->userIds($clean),
        ];
    }
}
