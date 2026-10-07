<?php

namespace App\Domain\Search\Providers;

use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Str;

/**
 * "Catatan" (F2-2): notes the viewer may open (Note::visibleTo), by title or
 * text (full text 'simple' + title substring), newest change first. Off with
 * the `notes` feature flag.
 */
final class NoteSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'notes';
    }

    public function label(): string
    {
        return 'Catatan';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        if (! (bool) config('features.notes')) {
            return [];
        }

        $notes = Note::query()
            ->visibleTo($viewer)
            ->matching($query)
            ->orderByDesc('notes.updated_at')
            ->limit($limit)
            ->get(['notes.id', 'notes.workspace_id', 'notes.title', 'notes.content_text', 'notes.updated_at']);

        $workspaces = Workspace::query()
            ->whereIn('id', $notes->pluck('workspace_id')->unique()->values()->all())
            ->get(['id', 'name', 'key', 'type'])
            ->keyBy('id');

        $results = [];

        foreach ($notes as $note) {
            $workspace = $workspaces->get($note->workspace_id);

            $results[] = new SearchResult(
                id: 'note:'.$note->id,
                title: $note->title,
                icon: 'file-text',
                url: '/catatan/'.$note->id,
                code: $workspace?->key,
                subtitle: 'Catatan'.($workspace === null ? '' : ' · '.($workspace->isPersonal() ? 'Pribadi' : $workspace->name)),
                snippet: self::snippet($note->content_text, $query),
            );
        }

        return $results;
    }

    /** Excerpt around the first matching word, or null when only the title matched. */
    private static function snippet(string $text, string $query): ?string
    {
        $flat = (string) preg_replace('/\s+/u', ' ', $text);

        foreach (preg_split('/\s+/u', trim($query)) ?: [] as $word) {
            $position = $word === '' ? false : mb_stripos($flat, $word);

            if ($position !== false) {
                $start = max(0, $position - 40);

                return ($start > 0 ? '…' : '').Str::limit(mb_substr($flat, $start), 120, '…');
            }
        }

        return null;
    }
}
