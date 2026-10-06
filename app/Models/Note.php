<?php

namespace App\Models;

use App\Casts\PostgresBytea;
use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Notes\Enums\NotePreset;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Workspaces\Enums\WorkspaceType;
use Carbon\CarbonImmutable;
use Database\Factories\NoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Catatan bersama (docs/DATABASE.md §7). The live document is a Yjs doc on
 * the collab server; `yjs_state` is its persisted state (never sent to the
 * browser) and `content` the sanitized ProseMirror snapshot used for
 * rendering, versions and search. Visibility: NotePolicy / scopeVisibleTo.
 *
 * @property string $id
 * @property string $company_id
 * @property string $workspace_id
 * @property string|null $parent_id
 * @property string $title
 * @property NoteKind $kind
 * @property NotePreset|null $preset
 * @property NoteAccess $access
 * @property string|null $yjs_state
 * @property array<string, mixed>|null $content
 * @property string $content_text
 * @property string|null $created_by
 * @property string|null $updated_by
 * @property string $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Workspace|null $workspace
 * @property-read Note|null $parent
 * @property-read User|null $creator
 * @property-read User|null $editor
 * @property-read Collection<int, NoteShare> $shares
 * @property-read Collection<int, NoteVersion> $versions
 */
#[Fillable(['company_id', 'workspace_id', 'parent_id', 'kind', 'preset', 'title', 'access', 'yjs_state', 'content', 'content_text', 'created_by', 'updated_by', 'position'])]
#[Hidden(['yjs_state', 'search_vector'])]
class Note extends Model
{
    /** @use HasFactory<NoteFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'kind' => NoteKind::class,
            'preset' => NotePreset::class,
            'access' => NoteAccess::class,
            'content' => 'array',
            'yjs_state' => PostgresBytea::class,
        ];
    }

    /**
     * Notes the viewer may open, same rules as NotePolicy::canView: shared
     * with them, or `workspace` access in a workspace they see, or their own
     * `restricted` note. Personal workspaces stay owner-only; inactive users
     * see nothing.
     *
     * @param  Builder<Note>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        if ($viewer->status !== UserStatus::Active) {
            $query->whereRaw('false');

            return;
        }

        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            // The workspace must still exist; a personal one only for its owner.
            ->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()
                ->where('company_id', $viewer->company_id)
                ->where(function (Builder $workspace) use ($viewer): void {
                    $workspace->where('type', '!=', WorkspaceType::Personal->value)
                        ->orWhere('owner_id', $viewer->id);
                })
                ->select('workspaces.id'))
            ->where(function (Builder $scope) use ($viewer): void {
                $scope->whereExists(function (QueryBuilder $share) use ($viewer): void {
                    $share->selectRaw('1')
                        ->from('note_shares')
                        ->whereColumn('note_shares.note_id', $this->qualifyColumn('id'))
                        ->where('note_shares.user_id', $viewer->id);
                })->orWhere(function (Builder $workspace) use ($viewer): void {
                    $workspace->where($this->qualifyColumn('access'), NoteAccess::Workspace->value)
                        ->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('workspaces.id'));
                })->orWhere(function (Builder $own) use ($viewer): void {
                    $own->where($this->qualifyColumn('access'), NoteAccess::Restricted->value)
                        ->where($this->qualifyColumn('created_by'), $viewer->id);
                });
            });
    }

    /**
     * Full-text match on title + text (tsvector 'simple', prefix on the last
     * word) or a title substring, for /catatan?q= and ⌘K.
     *
     * @param  Builder<Note>  $query
     */
    public function scopeMatching(Builder $query, string $search): void
    {
        $words = array_values(array_filter(
            preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($search)) ?: [],
            fn (string $word): bool => $word !== '',
        ));

        if ($words === []) {
            $query->whereRaw('false');

            return;
        }

        $tsQuery = implode(' & ', array_map(fn (string $word): string => $word.':*', array_slice($words, 0, 8)));
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower(trim($search))).'%';

        $query->where(function (Builder $match) use ($tsQuery, $like): void {
            $match->whereRaw("notes.search_vector @@ to_tsquery('simple', ?)", [$tsQuery])
                ->orWhereRaw('lower(notes.title) LIKE ?', [$like]);
        });
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<Note, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Note::class, 'parent_id');
    }

    /**
     * @return HasMany<Note, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Note::class, 'parent_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * @return HasMany<NoteShare, $this>
     */
    public function shares(): HasMany
    {
        return $this->hasMany(NoteShare::class);
    }

    /**
     * @return HasMany<NoteVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(NoteVersion::class);
    }

    /**
     * @return MorphMany<Mention, $this>
     */
    public function mentions(): MorphMany
    {
        return $this->morphMany(Mention::class, 'mentionable');
    }

    public function isFolder(): bool
    {
        return $this->kind === NoteKind::Folder;
    }

    /**
     * Share row of the user (loaded `shares` are reused).
     */
    public function shareOf(User $user): ?NoteShare
    {
        if ($this->relationLoaded('shares')) {
            return $this->shares->firstWhere('user_id', $user->id);
        }

        return $this->shares()->where('user_id', $user->id)->first();
    }
}
