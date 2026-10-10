<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Tasks\Services\MentionParser;
use App\Http\Resources\Chat\ChatPresenter;
use App\Models\Channel;
use App\Models\Message;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * One page of a channel: the newest top-level messages (older pages with
 * `$before`), all their thread replies, grouped reactions, Drive attachments
 * and the tasks referenced with #KEY-n that the viewer may see.
 */
final class ChannelTimeline
{
    public const int PAGE = 50;

    public function __construct(private readonly MentionParser $parser) {}

    /**
     * @param  int  $limit  page size (web board 50; the mobile API asks 30)
     * @return array{messages: list<array<string, mixed>>, tasks: list<array<string, mixed>>, has_more: bool}
     */
    public function page(Channel $channel, User $viewer, ?string $before = null, int $limit = self::PAGE): array
    {
        $limit = max(1, $limit);

        $roots = Message::withTrashed()
            ->where('channel_id', $channel->id)
            ->whereNull('parent_id')
            ->when($before !== null, fn ($query) => $query->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        $hasMore = $roots->count() > $limit;
        $roots = $roots->take($limit);

        $replies = $roots->isEmpty() ? new Collection : Message::withTrashed()
            ->whereIn('parent_id', $roots->pluck('id'))
            ->orderBy('id')
            ->get();

        /** @var Collection<int, Message> $messages */
        $messages = $roots->reverse()->values()->concat($replies);

        return [
            'messages' => $this->present($messages),
            'tasks' => $this->tasks($messages, $viewer),
            'has_more' => $hasMore,
        ];
    }

    /**
     * Single message (realtime refetch), with the tasks it references.
     *
     * @return array{message: array<string, mixed>, tasks: list<array<string, mixed>>}
     */
    public function one(Message $message, User $viewer): array
    {
        $messages = new Collection([$message]);

        return ['message' => $this->present($messages)[0], 'tasks' => $this->tasks($messages, $viewer)];
    }

    /**
     * @param  Collection<int, Message>  $messages
     * @return list<array<string, mixed>>
     */
    private function present(Collection $messages): array
    {
        $messages->load(['reactions', 'attachments.driveFile']);

        return array_values($messages->map(fn (Message $message): array => ChatPresenter::message($message))->all());
    }

    /**
     * @param  Collection<int, Message>  $messages
     * @return list<array<string, mixed>>
     */
    private function tasks(Collection $messages, User $viewer): array
    {
        $ids = $messages
            ->reject(fn (Message $message): bool => $message->trashed())
            ->flatMap(fn (Message $message): array => $this->parser->taskIds($message->body))
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return [];
        }

        return array_values(Task::query()
            ->visibleTo($viewer)
            ->whereIn('tasks.id', $ids)
            ->with('workspace:id,key')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category'])
            ->map(fn (Task $task): array => [
                'id' => $task->id,
                'key' => $task->displayKey(),
                'title' => $task->title,
                'status_category' => $task->status_category->value,
                'url' => $task->url(),
            ])
            ->all());
    }
}
