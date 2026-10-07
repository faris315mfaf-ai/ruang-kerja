<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Notes\Services\CollabBridge;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Bagikan": general access (workspace / only invited) and the invited
 * people with their role. The list replaces the stored one; invited people
 * must be active employees of the same company. Written to audit_logs
 * (`note.share_updated`). Open editing sessions are closed afterwards so
 * everyone reconnects with their new rights.
 */
final class UpdateNoteShare
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CollabBridge $collab,
    ) {}

    /**
     * @param  list<array{user_id: string, role: string}>  $people
     */
    public function handle(Note $note, User $actor, NoteAccess $access, array $people): Note
    {
        $roles = [];

        foreach ($people as $person) {
            $roles[$person['user_id']] = NoteShareRole::from($person['role']);
        }

        $valid = User::query()
            ->whereIn('id', array_keys($roles))
            ->where('company_id', $note->company_id)
            ->where('status', UserStatus::Active)
            ->pluck('id')
            ->all();

        if (count($valid) !== count($roles)) {
            throw ValidationException::withMessages(['people' => 'Ada orang yang tidak dapat diundang ke catatan ini.']);
        }

        $before = $this->snapshot($note);

        DB::transaction(function () use ($note, $access, $roles): void {
            $note->forceFill(['access' => $access])->save();

            $note->shares()->whereNotIn('user_id', array_keys($roles))->delete();

            foreach ($roles as $userId => $role) {
                NoteShare::query()->updateOrCreate(
                    ['note_id' => $note->id, 'user_id' => $userId],
                    ['role' => $role],
                );
            }
        });

        $note->unsetRelation('shares');
        $after = $this->snapshot($note);

        if ($before !== $after) {
            $this->audit->log('note.share_updated', $note, $before, $after, $actor);
            $this->collab->reconnect($note);
        }

        return $note;
    }

    /**
     * @return array{access: string, people: array<string, string>}
     */
    private function snapshot(Note $note): array
    {
        $people = $note->shares()->orderBy('user_id')->get(['user_id', 'role'])
            ->mapWithKeys(fn (NoteShare $share): array => [$share->user_id => $share->role->value])
            ->all();

        return ['access' => $note->access->value, 'people' => $people];
    }
}
