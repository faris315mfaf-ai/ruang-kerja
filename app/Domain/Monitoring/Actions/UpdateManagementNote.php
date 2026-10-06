<?php

namespace App\Domain\Monitoring\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Models\ManagementNote;
use Illuminate\Support\Facades\DB;

/**
 * Edits a "catatan tindakan": text, due date, done / not done. A note that is
 * reopened goes back to the bottom of the open list. Authorized by
 * ManagementNotePolicy::update (owner only).
 */
final class UpdateManagementNote
{
    /**
     * @param  array{body?: string, due_on?: string|null, done?: bool}  $changes
     */
    public function handle(ManagementNote $note, array $changes): ManagementNote
    {
        return DB::transaction(function () use ($note, $changes): ManagementNote {
            if (array_key_exists('body', $changes)) {
                $note->body = trim($changes['body']);
            }

            if (array_key_exists('due_on', $changes)) {
                $note->setAttribute('due_on', $changes['due_on']);
            }

            if (array_key_exists('done', $changes)) {
                if ($changes['done'] && $note->done_at === null) {
                    $note->done_at = now();
                } elseif (! $changes['done'] && $note->done_at !== null) {
                    $note->done_at = null;
                    $last = ManagementNote::query()->where('user_id', $note->user_id)->whereNull('done_at')->orderByDesc('position')->value('position');
                    $note->position = Lexorank::between(is_string($last) ? $last : null, null);
                }
            }

            $note->save();

            return $note;
        });
    }
}
