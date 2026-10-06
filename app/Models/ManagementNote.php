<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\ManagementNoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One "catatan tindakan" of a Direksi / management member (keputusan pemilik
 * 6 Okt 2026, docs/DATABASE.md §4 management_notes). Private to its owner.
 *
 * @property string $id
 * @property string $company_id
 * @property string $user_id
 * @property string $body
 * @property CarbonImmutable|null $due_on
 * @property CarbonImmutable|null $done_at
 * @property string $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 */
#[Fillable(['company_id', 'user_id', 'body', 'due_on', 'done_at', 'position'])]
class ManagementNote extends Model
{
    /** @use HasFactory<ManagementNoteFactory> */
    use HasFactory, HasUlids;

    /** Notes one person can keep (open + done). */
    public const int LIMIT = 200;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'done_at' => 'datetime',
        ];
    }

    public function isDone(): bool
    {
        return $this->done_at !== null;
    }

    /**
     * The only way notes are listed: the owner's own.
     *
     * @param  Builder<ManagementNote>  $query
     */
    public function scopeOwnedBy(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('user_id'), $user->id)
            ->where($this->qualifyColumn('company_id'), $user->company_id);
    }

    /**
     * Open notes in the owner's order, then done ones (latest first).
     *
     * @param  Builder<ManagementNote>  $query
     */
    public function scopeInListOrder(Builder $query): void
    {
        $query->orderByRaw('done_at is not null')
            ->orderByDesc('done_at')
            ->orderBy('position')
            ->orderBy('created_at');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
