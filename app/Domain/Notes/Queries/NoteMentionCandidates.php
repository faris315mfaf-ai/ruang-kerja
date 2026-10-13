<?php

namespace App\Domain\Notes\Queries;

use App\Domain\Notes\Services\NoteAudience;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Note;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

/**
 * "@" picker of the mobile editor: active people of the company, matched by
 * name, who can open the note (NoteAudience → NotePolicy::canView) — a
 * mention never reaches someone who cannot read the note. The pool puts
 * members of the workspace, invited people and the author first, so the
 * likely candidates are checked before the rest; the viewer is left out.
 */
final class NoteMentionCandidates
{
    public const int POOL = 60;

    public const int DEFAULT_LIMIT = 8;

    public const int MAX_LIMIT = 20;

    public function __construct(private readonly NoteAudience $audience) {}

    /**
     * @return list<array{id: string, name: string, avatar: string|null, title: string}>
     */
    public function handle(Note $note, User $viewer, string $search, int $limit = self::DEFAULT_LIMIT): array
    {
        $limit = max(1, min($limit, self::MAX_LIMIT));
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower(trim($search))).'%';

        /** @var list<string> $pool */
        $pool = array_values(User::query()
            ->where('company_id', $viewer->company_id)
            ->where('status', UserStatus::Active)
            ->whereKeyNot($viewer->id)
            ->when(trim($search) !== '', fn ($query) => $query->whereRaw('lower(users.name) LIKE ?', [$like]))
            ->orderByRaw(
                'CASE WHEN users.id IN (SELECT user_id FROM workspace_members WHERE workspace_id = ?)'
                .' OR users.id IN (SELECT user_id FROM note_shares WHERE note_id = ?)'
                .' OR users.id = ? THEN 0 ELSE 1 END',
                [$note->workspace_id, $note->id, $note->created_by ?? ''],
            )
            ->orderBy('users.name')
            ->limit(self::POOL)
            ->pluck('id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());

        $rank = array_flip($pool);

        $people = new EloquentCollection($this->audience->withAccess($note, $pool)
            ->sortBy(fn (User $user): int => $rank[$user->id] ?? 0)
            ->take($limit)
            ->values()
            ->all());

        return array_values($people
            ->load('position:id,name')
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'avatar' => $user->avatar_url,
                'title' => $user->position->name ?? '',
            ])
            ->all());
    }
}
