<?php

namespace App\Domain\Notes\Queries;

use App\Models\Note;
use App\Models\NoteShare;

/**
 * "Bagikan" dialog of the mobile app: general access and the invited
 * people with their names (the web share dialog gets the names from its
 * people list; the app has none).
 */
final class NoteAccessView
{
    /**
     * @return array<string, mixed>
     */
    public function present(Note $note): array
    {
        $note->unsetRelation('shares');
        $note->load(['shares.user.position:id,name', 'creator:id,name,avatar_url']);

        return [
            'note_id' => $note->id,
            'access' => $note->access->value,
            'access_label' => $note->access->label(),
            'author' => $note->creator === null ? null : [
                'id' => $note->creator->id,
                'name' => $note->creator->name,
                'avatar' => $note->creator->avatar_url,
            ],
            'people' => array_values($note->shares
                ->sortBy([['created_at', 'asc'], ['id', 'asc']])
                ->map(fn (NoteShare $share): array => [
                    'user_id' => $share->user_id,
                    'name' => $share->user->name,
                    'avatar' => $share->user->avatar_url,
                    'title' => $share->user->position->name ?? '',
                    'role' => $share->role->value,
                    'role_label' => $share->role->label(),
                ])
                ->all()),
        ];
    }
}
