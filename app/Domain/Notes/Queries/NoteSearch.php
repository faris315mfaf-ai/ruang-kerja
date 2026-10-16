<?php

namespace App\Domain\Notes\Queries;

use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonInterface;

/**
 * "Cari catatan" of the mobile app: visible notes (Note::visibleTo — the
 * web rules) whose title or text matches (full text 'simple', prefix on the
 * last word, or a title substring: Note::matching), newest edit first, with
 * a plain-text snippet and the number of matches per workspace for the
 * filter chips. A fixed number of queries.
 */
final class NoteSearch
{
    public const int DEFAULT_LIMIT = 30;

    public const int MAX_LIMIT = 50;

    private const int SNIPPET_BEFORE = 50;

    private const int SNIPPET_LENGTH = 160;

    /**
     * @return array{query: string, total: int, workspaces: list<array{id: string, key: string, name: string, count: int}>, results: list<array<string, mixed>>}
     */
    public function handle(User $viewer, string $query, ?string $workspaceId = null, int $limit = self::DEFAULT_LIMIT): array
    {
        $limit = max(1, min($limit, self::MAX_LIMIT));

        $base = Note::query()->visibleTo($viewer)->matching($query);

        /** @var array<string, int> $counts */
        $counts = (clone $base)
            ->reorder()
            ->selectRaw('notes.workspace_id, count(*) as total')
            ->groupBy('notes.workspace_id')
            ->pluck('total', 'workspace_id')
            ->map(fn (mixed $total): int => (int) $total)
            ->all();

        $notes = (clone $base)
            ->when($workspaceId !== null, fn ($scope) => $scope->where('notes.workspace_id', $workspaceId))
            ->with(['workspace:id,key,name,type', 'creator:id,name'])
            ->orderByDesc('notes.updated_at')
            ->orderByDesc('notes.id')
            ->limit($limit)
            ->get(['notes.id', 'notes.workspace_id', 'notes.parent_id', 'notes.kind', 'notes.preset', 'notes.title', 'notes.access', 'notes.content_text', 'notes.created_by', 'notes.updated_at']);

        $workspaces = array_values(Workspace::query()
            ->whereIn('id', array_keys($counts))
            ->get(['id', 'key', 'name', 'type'])
            ->sortBy(fn (Workspace $workspace): string => ($workspace->isPersonal() ? '0' : '1').mb_strtolower($workspace->name))
            ->map(fn (Workspace $workspace): array => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->isPersonal() ? 'Pribadi' : $workspace->name,
                'count' => $counts[$workspace->id] ?? 0,
            ])
            ->values()
            ->all());

        return [
            'query' => $query,
            'total' => array_sum($counts),
            'workspaces' => $workspaces,
            'results' => array_values($notes->map(fn (Note $note): array => [
                'id' => $note->id,
                'workspace_id' => $note->workspace_id,
                'workspace_name' => $note->workspace === null ? null : ($note->workspace->isPersonal() ? 'Pribadi' : $note->workspace->name),
                'parent_id' => $note->parent_id,
                'kind' => $note->kind->value,
                'preset' => $note->preset?->value,
                'title' => $note->title,
                'access' => $note->access->value,
                'invited_only' => $note->access->value === 'restricted',
                'snippet' => self::snippet($note->content_text, $query),
                'penulis' => $note->creator?->name,
                'updated_at' => self::iso($note->updated_at),
            ])->all()),
        ];
    }

    /**
     * About 160 characters of the plain text around the first matching word;
     * null when the text is empty (a title-only match on an empty note).
     */
    public static function snippet(?string $text, string $query): ?string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', (string) $text));

        if ($text === '') {
            return null;
        }

        $position = null;

        foreach (preg_split('/[^\p{L}\p{N}]+/u', $query) ?: [] as $word) {
            if ($word === '') {
                continue;
            }

            $found = mb_stripos($text, $word);

            if ($found !== false && ($position === null || $found < $position)) {
                $position = $found;
            }
        }

        $start = max(0, ($position ?? 0) - self::SNIPPET_BEFORE);
        $excerpt = mb_substr($text, $start, self::SNIPPET_LENGTH);

        return ($start > 0 ? '…' : '').$excerpt.($start + self::SNIPPET_LENGTH < mb_strlen($text) ? '…' : '');
    }

    private static function iso(?CarbonInterface $value): ?string
    {
        return $value?->toIso8601String();
    }
}
