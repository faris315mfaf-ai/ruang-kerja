<?php

namespace App\Models;

use App\Domain\Chat\Enums\ChannelType;
use Carbon\CarbonImmutable;
use Database\Factories\ChannelFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Obrolan channel (docs/DATABASE.md §7). Visibility: workspace channels follow
 * the workspace (WorkspacePolicy), public channels every employee of the
 * company, private channels / DMs / groups their members only.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $workspace_id
 * @property ChannelType $type
 * @property string|null $name
 * @property string|null $topic
 * @property string|null $direct_key
 * @property string|null $created_by
 * @property CarbonImmutable|null $archived_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace|null $workspace
 * @property-read Collection<int, ChannelMember> $memberships
 * @property-read Collection<int, User> $members
 */
#[Fillable(['company_id', 'workspace_id', 'type', 'name', 'topic', 'direct_key', 'created_by', 'archived_at'])]
class Channel extends Model
{
    /** @use HasFactory<ChannelFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => ChannelType::class,
            'archived_at' => 'datetime',
        ];
    }

    /**
     * Channels the viewer may read, same rules as ChannelPolicy::view.
     *
     * @param  Builder<Channel>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            ->where(function (Builder $scope) use ($viewer): void {
                $scope->where(function (Builder $workspace) use ($viewer): void {
                    $workspace->where($this->qualifyColumn('type'), ChannelType::Workspace->value)
                        ->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('workspaces.id'));
                })->orWhere($this->qualifyColumn('type'), ChannelType::Public->value)
                    ->orWhere(function (Builder $membersOnly) use ($viewer): void {
                        $membersOnly->whereIn($this->qualifyColumn('type'), [ChannelType::Private->value, ChannelType::Dm->value, ChannelType::Group->value])
                            ->whereExists(function (QueryBuilder $member) use ($viewer): void {
                                $member->selectRaw('1')
                                    ->from('channel_members')
                                    ->whereColumn('channel_members.channel_id', $this->qualifyColumn('id'))
                                    ->where('channel_members.user_id', $viewer->id);
                            });
                    });
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
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<ChannelMember, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(ChannelMember::class);
    }

    /**
     * @return BelongsToMany<User, $this, ChannelMember>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'channel_members')
            ->using(ChannelMember::class)
            ->withPivot(['role', 'muted', 'last_read_message_id', 'joined_at'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function membershipOf(User $user): ?ChannelMember
    {
        if ($this->relationLoaded('memberships')) {
            return $this->memberships->firstWhere('user_id', $user->id);
        }

        return $this->memberships()->where('user_id', $user->id)->first();
    }

    public function hasMember(User $user): bool
    {
        return $this->membershipOf($user) !== null;
    }

    /**
     * Read-only: the channel or its workspace is archived.
     */
    public function isArchived(): bool
    {
        if ($this->archived_at !== null) {
            return true;
        }

        return $this->type === ChannelType::Workspace && $this->workspace?->archived_at !== null;
    }

    /**
     * @param  list<string>  $userIds
     */
    public static function directKey(array $userIds): string
    {
        $ids = array_values(array_unique($userIds));
        sort($ids);

        return hash('sha256', implode('|', $ids));
    }
}
