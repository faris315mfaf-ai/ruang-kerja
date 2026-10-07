<?php

namespace App\Models;

use App\Domain\Notes\Enums\NoteShareRole;
use Carbon\CarbonImmutable;
use Database\Factories\NoteShareFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Person invited to a note (docs/DATABASE.md §7), written by UpdateNoteShare.
 * The role wins over the workspace role for that note.
 *
 * @property string $id
 * @property string $note_id
 * @property string $user_id
 * @property NoteShareRole $role
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Note $note
 * @property-read User $user
 */
#[Fillable(['note_id', 'user_id', 'role'])]
class NoteShare extends Model
{
    /** @use HasFactory<NoteShareFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'role' => NoteShareRole::class,
        ];
    }

    /**
     * @return BelongsTo<Note, $this>
     */
    public function note(): BelongsTo
    {
        return $this->belongsTo(Note::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
