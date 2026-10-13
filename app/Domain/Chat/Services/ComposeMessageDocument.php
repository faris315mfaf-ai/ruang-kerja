<?php

namespace App\Domain\Chat\Services;

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Tasks\Services\RichText;
use App\Models\Channel;
use App\Models\Task;
use App\Models\User;

/**
 * Plain text from the mobile composer + the ids it resolved (`mentions`,
 * `task_refs`) → the same Tiptap document the web composer produces: the
 * literal `@Nama Lengkap` / `#KEY-n` in the text become `mention` /
 * `taskReference` nodes. Ids whose token is not in the text are appended at
 * the end. ChatRichText (PostMessage / EditMessage) still decides who may
 * really be mentioned (readers of the channel) and which tasks the author
 * may reference; everything else falls back to plain text.
 */
final class ComposeMessageDocument
{
    /**
     * @param  list<string>  $mentionIds
     * @param  list<string>  $taskIds
     * @return array<string, mixed>|null
     */
    public function handle(Channel $channel, User $author, ?string $text, array $mentionIds = [], array $taskIds = []): ?array
    {
        $mentionIds = array_values(array_unique($mentionIds));
        $taskIds = array_values(array_unique($taskIds));

        if ($mentionIds === [] && $taskIds === []) {
            return RichText::fromText($text);
        }

        /** @var array<string, array<string, mixed>> $nodes lower-cased token => node */
        $nodes = [];

        $people = User::query()
            ->whereIn('id', $mentionIds)
            ->where('company_id', $channel->company_id)
            ->where('status', UserStatus::Active)
            ->get(['id', 'name']);

        foreach ($people as $person) {
            $token = '@'.$person->name;
            $nodes[mb_strtolower($token)] = ['type' => 'mention', 'attrs' => ['id' => $person->id, 'label' => $person->name]];
        }

        $tasks = $taskIds === [] ? collect() : Task::query()
            ->visibleTo($author)
            ->whereIn('tasks.id', $taskIds)
            ->with('workspace:id,key')
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number']);

        foreach ($tasks as $task) {
            $token = '#'.$task->displayKey();
            $nodes[mb_strtolower($token)] = ['type' => 'taskReference', 'attrs' => ['id' => $task->id, 'label' => $task->displayKey()]];
        }

        if ($nodes === []) {
            return RichText::fromText($text);
        }

        $text = $text === null ? '' : trim(str_replace("\r\n", "\n", $text));
        $used = [];
        $paragraphs = [];

        foreach (explode("\n", $text) as $line) {
            $paragraphs[] = $this->paragraph($line, $nodes, $used);
        }

        // Resolved ids that were never typed in the text still count as mentions.
        $missing = array_values(array_diff_key($nodes, array_flip($used)));

        if ($missing !== []) {
            $last = array_key_last($paragraphs);
            $content = $paragraphs[$last]['content'] ?? [];

            foreach ($missing as $node) {
                if ($content !== []) {
                    $content[] = ['type' => 'text', 'text' => ' '];
                }

                $content[] = $node;
            }

            $paragraphs[$last] = ['type' => 'paragraph', 'content' => $content];
        }

        return ['type' => 'doc', 'content' => $paragraphs];
    }

    /**
     * @param  array<string, array<string, mixed>>  $nodes
     * @param  list<string>  $used
     * @return array<string, mixed>
     */
    private function paragraph(string $line, array $nodes, array &$used): array
    {
        if ($line === '') {
            return ['type' => 'paragraph'];
        }

        $tokens = array_keys($nodes);
        usort($tokens, fn (string $a, string $b): int => mb_strlen($b) <=> mb_strlen($a));

        $pattern = '/('.implode('|', array_map(fn (string $token): string => preg_quote($token, '/'), $tokens)).')/iu';
        $parts = preg_split($pattern, $line, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
        $content = [];

        foreach ($parts === false ? [$line] : $parts as $part) {
            $key = mb_strtolower($part);

            if (isset($nodes[$key])) {
                $content[] = $nodes[$key];
                $used[] = $key;
            } else {
                $content[] = ['type' => 'text', 'text' => $part];
            }
        }

        return ['type' => 'paragraph', 'content' => $content];
    }
}
