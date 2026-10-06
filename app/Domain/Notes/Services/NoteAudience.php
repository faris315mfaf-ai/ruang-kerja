<?php

namespace App\Domain\Notes\Services;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\Note;
use App\Models\User;
use App\Policies\NotePolicy;
use Illuminate\Support\Collection;

/**
 * Who may open a note (NotePolicy::canView): mentions only reach these
 * people, so no note content leaks to someone who cannot read it.
 */
final class NoteAudience
{
    public function __construct(private readonly NotePolicy $policy) {}

    /**
     * Active users among `$userIds` who can open the note.
     *
     * @param  list<string>  $userIds
     * @return Collection<int, User>
     */
    public function withAccess(Note $note, array $userIds): Collection
    {
        if ($userIds === []) {
            return collect();
        }

        $note->loadMissing(['workspace', 'shares']);

        return User::query()
            ->whereIn('id', array_values(array_unique($userIds)))
            ->where('company_id', $note->company_id)
            ->where('status', UserStatus::Active)
            ->get()
            ->filter(fn (User $user): bool => $this->policy->canView($user, $note))
            ->values();
    }
}
