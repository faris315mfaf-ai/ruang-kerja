<?php

namespace App\Models;

use App\Casts\PostgresBytea;
use Carbon\CarbonImmutable;
use Database\Factories\NoteVersionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Snapshot of a note (docs/DATABASE.md §7): taken by StoreNoteState at most
 * every 5 minutes of editing and by RestoreNoteVersion. Append-only.
 *
 * @property string $id
 * @property string $note_id
 * @property string|null $yjs_state
 * @property array<string, mixed>|null $content
 * @property string $title
 * @property string|null $label
 * @property string|null $created_by
 * @property CarbonImmutable $created_at
 * @property-read Note $note
 * @property-read User|null $creator
 */
#[Fillable(['note_id', 'yjs_state', 'content', 'title', 'label', 'created_by', 'created_at'])]
#[Hidden(['yjs_state'])]
class NoteVersion extends Model
{
    /** @use HasFactory<NoteVersionFactory> */
    use HasFactory, HasUlids;

    public const null UPDATED_AT = null;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'content' => 'array',
            'yjs_state' => PostgresBytea::class,
            'created_at' => 'datetime',
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
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
