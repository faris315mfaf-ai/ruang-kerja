<?php

namespace App\Models;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * workspace_members row (composite key workspace_id + user_id). Write it with
 * query builder calls (insert/update/delete), not save() on a loaded row.
 *
 * @property string $workspace_id
 * @property string $user_id
 * @property WorkspaceRole $role
 * @property CarbonImmutable|null $joined_at
 * @property bool $is_synced
 * @property CarbonImmutable|null $favorited_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 * @property-read User $user
 */
class WorkspaceMember extends Pivot
{
    protected $table = 'workspace_members';

    public $incrementing = false;

    public $timestamps = true;

    /** @var list<string> */
    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => WorkspaceRole::class,
            'joined_at' => 'datetime',
            'is_synced' => 'boolean',
            'favorited_at' => 'datetime',
        ];
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
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
