<?php

namespace App\Models;

use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveMember;
use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use Carbon\CarbonImmutable;
use Database\Factories\WorkspaceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Workspace: personal, team, division or project (docs/DATABASE.md §4).
 *
 * @property string $id
 * @property string $company_id
 * @property WorkspaceType $type
 * @property string $name
 * @property string $key
 * @property list<string> $previous_keys
 * @property string|null $description
 * @property string|null $icon
 * @property string|null $color
 * @property WorkspaceVisibility $visibility
 * @property string $owner_id
 * @property string|null $division_id Division workspace: the division; project: "divisi utama" (PRD M10).
 * @property string|null $team_id
 * @property SystemWorkspace|null $system_key Ruang HR system workspace (keputusan pemilik 20 Okt 2026).
 * @property bool $tasks_private Members below admin only see tasks assigned to them.
 * @property string|null $drive_folder_id
 * @property int $task_sequence
 * @property CarbonImmutable|null $archived_at
 * @property string|null $lead_user_id
 * @property string|null $sponsor_user_id
 * @property CarbonImmutable|null $start_date
 * @property CarbonImmutable|null $target_date
 * @property ProjectStatus|null $project_status
 * @property ProjectHealth|null $health
 * @property CarbonImmutable|null $last_update_at
 * @property CarbonImmutable|null $completed_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Company $company
 * @property-read User $owner
 * @property-read Division|null $division
 * @property-read Team|null $team
 * @property-read WorkspaceMember|null $membership
 * @property-read User|null $lead
 * @property-read User|null $sponsor
 */
#[Fillable([
    'company_id', 'type', 'name', 'key', 'previous_keys', 'description', 'icon', 'color',
    'visibility', 'owner_id', 'division_id', 'team_id', 'drive_folder_id', 'archived_at',
    'lead_user_id', 'sponsor_user_id', 'start_date', 'target_date', 'project_status',
])]
class Workspace extends Model implements HasDriveFolder
{
    /** @use HasFactory<WorkspaceFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'visibility' => 'private',
        'task_sequence' => 0,
        'previous_keys' => '[]',
        'tasks_private' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => WorkspaceType::class,
            'visibility' => WorkspaceVisibility::class,
            'previous_keys' => 'array',
            'system_key' => SystemWorkspace::class,
            'tasks_private' => 'boolean',
            'task_sequence' => 'integer',
            'archived_at' => 'datetime',
            'start_date' => 'date',
            'target_date' => 'date',
            'project_status' => ProjectStatus::class,
            'health' => ProjectHealth::class,
            'last_update_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * URLs use the key: /w/OPS (see the explicit binding in routes/workspaces.php).
     */
    public function getRouteKeyName(): string
    {
        return 'key';
    }

    public function isPersonal(): bool
    {
        return $this->type === WorkspaceType::Personal;
    }

    public function isProject(): bool
    {
        return $this->type === WorkspaceType::Project;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /**
     * Ruang HR system workspace (Tim HR, Penugasan HR): no archive, key or
     * visibility changes; HR admins are synced from the global roles.
     */
    public function isSystem(): bool
    {
        $this->loadSystemColumns();

        return $this->system_key !== null;
    }

    /**
     * Private tasks (Penugasan HR): members below admin — and anyone else
     * who can see the workspace without being admin — only see the tasks
     * assigned to them (Task::scopeVisibleTo, TaskPolicy).
     */
    public function hasPrivateTasks(): bool
    {
        $this->loadSystemColumns();

        return (bool) $this->tasks_private;
    }

    /**
     * Partial loads (`workspace:id,key`) do not carry system_key /
     * tasks_private; the privacy rules must never guess, so they are read once
     * for this instance (eager-loaded relations share one instance per id).
     */
    private function loadSystemColumns(): void
    {
        if (array_key_exists('tasks_private', $this->attributes) && array_key_exists('system_key', $this->attributes)) {
            return;
        }

        $id = $this->attributes['id'] ?? null;
        $row = $this->exists && is_string($id)
            ? DB::table('workspaces')->where('id', $id)->first(['system_key', 'tasks_private'])
            : null;

        foreach (['system_key' => $row === null ? null : $row->system_key, 'tasks_private' => $row !== null && (bool) $row->tasks_private] as $column => $value) {
            if (! array_key_exists($column, $this->attributes)) {
                $this->attributes[$column] = $value;
                $this->original[$column] = $value;
            }
        }
    }

    /**
     * Role of $user inside this workspace, or null when not a member.
     * Uses the eager-loaded `membership` (see scopeWithMembershipOf) when present.
     */
    public function roleOf(User $user): ?WorkspaceRole
    {
        if ($this->isPersonal()) {
            return $this->owner_id === $user->id ? WorkspaceRole::Owner : null;
        }

        if ($this->relationLoaded('membership') && $this->membership?->user_id === $user->id) {
            return $this->membership->role;
        }

        return WorkspaceMember::query()
            ->where('workspace_id', $this->id)
            ->where('user_id', $user->id)
            ->first(['role'])
            ?->role;
    }

    /**
     * Resolves a workspace of one company by its key (case-insensitive; keys
     * are unique per company only). Falls back to keys used before a rename;
     * callers redirect to the current key in that case.
     */
    public static function findByKey(string $key, ?string $companyId): ?self
    {
        if ($companyId === null) {
            return null;
        }

        $key = mb_strtoupper(trim($key));
        $inCompany = fn () => static::query()->where('company_id', $companyId);

        return $inCompany()->where('key', $key)->first()
            ?? $inCompany()->whereJsonContains('previous_keys', $key)->orderByDesc('updated_at')->first();
    }

    /**
     * Workspaces $viewer may see (docs/ARCHITECTURE.md §4):
     * - personal: only the owner (not even Super Admin or Direksi);
     * - non-personal: members, everyone for `internal`, Direksi/Super Admin
     *   (workspaces.view_all / workspaces.manage), and Kepala Divisi for projects
     *   involving their division (PRD M10).
     *
     * @param  Builder<Workspace>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            ->where(function (Builder $scope) use ($viewer): void {
                $scope->where(function (Builder $personal) use ($viewer): void {
                    $personal->where($this->qualifyColumn('type'), WorkspaceType::Personal->value)
                        ->where($this->qualifyColumn('owner_id'), $viewer->id);
                })->orWhere(function (Builder $shared) use ($viewer): void {
                    $shared->where($this->qualifyColumn('type'), '!=', WorkspaceType::Personal->value);

                    if (self::seesAllShared($viewer)) {
                        return;
                    }

                    $shared->where(function (Builder $access) use ($viewer): void {
                        $access->where($this->qualifyColumn('visibility'), WorkspaceVisibility::Internal->value)
                            ->orWhereExists(function (QueryBuilder $member) use ($viewer): void {
                                $member->selectRaw('1')
                                    ->from('workspace_members')
                                    ->whereColumn('workspace_members.workspace_id', $this->qualifyColumn('id'))
                                    ->where('workspace_members.user_id', $viewer->id);
                            });

                        $divisionIds = $viewer->hasRole(Role::KepalaDivisi) ? $viewer->ledDivisionIds() : [];

                        if ($divisionIds !== []) {
                            $access->orWhere(function (Builder $project) use ($divisionIds): void {
                                $project->where($this->qualifyColumn('type'), WorkspaceType::Project->value)
                                    ->where(function (Builder $involved) use ($divisionIds): void {
                                        // Primary division (Sprint 9) or a member from the division.
                                        $involved->whereIn($this->qualifyColumn('division_id'), $divisionIds)
                                            ->orWhereExists(function (QueryBuilder $member) use ($divisionIds): void {
                                                $member->selectRaw('1')
                                                    ->from('workspace_members')
                                                    ->join('users', 'users.id', '=', 'workspace_members.user_id')
                                                    ->whereColumn('workspace_members.workspace_id', $this->qualifyColumn('id'))
                                                    ->whereIn('users.division_id', $divisionIds);
                                            });
                                    });
                            });
                        }
                    });
                });
            });
    }

    /**
     * Projects on the portfolio of $viewer (PRD M10 "Akses"): Direksi and Super
     * Admin (portfolio.view) see every project; a Kepala Divisi sees projects
     * involving the divisions they lead (primary division or a member from it);
     * everyone sees projects they are PIC, sponsor or member of. Unlike
     * visibleTo(), `internal` visibility does not put a project on the portfolio.
     *
     * @param  Builder<Workspace>  $query
     */
    public function scopePortfolioFor(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            ->where($this->qualifyColumn('type'), WorkspaceType::Project->value);

        if ($viewer->hasPermission(Permission::PortfolioView)) {
            return;
        }

        $divisionIds = $viewer->hasRole(Role::KepalaDivisi) ? $viewer->ledDivisionIds() : [];

        $query->where(function (Builder $scope) use ($viewer, $divisionIds): void {
            // PIC / sponsor only while they can still see the project (a stale
            // assignment must not keep a private project on their portfolio).
            $scope->where(function (Builder $role) use ($viewer): void {
                $role->where(fn (Builder $either) => $either
                    ->where($this->qualifyColumn('lead_user_id'), $viewer->id)
                    ->orWhere($this->qualifyColumn('sponsor_user_id'), $viewer->id))
                    ->whereIn($this->qualifyColumn('id'), self::query()->visibleTo($viewer)->select('id'));
            })
                ->orWhereExists(function (QueryBuilder $member) use ($viewer): void {
                    $member->selectRaw('1')
                        ->from('workspace_members')
                        ->whereColumn('workspace_members.workspace_id', $this->qualifyColumn('id'))
                        ->where('workspace_members.user_id', $viewer->id);
                });

            if ($divisionIds !== []) {
                $scope->orWhereIn($this->qualifyColumn('division_id'), $divisionIds)
                    ->orWhereExists(function (QueryBuilder $member) use ($divisionIds): void {
                        $member->selectRaw('1')
                            ->from('workspace_members')
                            ->join('users', 'users.id', '=', 'workspace_members.user_id')
                            ->whereColumn('workspace_members.workspace_id', $this->qualifyColumn('id'))
                            ->whereIn('users.division_id', $divisionIds);
                    });
            }
        });
    }

    /**
     * Workspaces where $user is a member (personal: owner), i.e. the sidebar list.
     *
     * @param  Builder<Workspace>  $query
     */
    public function scopeJoinedBy(Builder $query, User $user): void
    {
        $query->where(function (Builder $scope) use ($user): void {
            $scope->where(function (Builder $personal) use ($user): void {
                $personal->where($this->qualifyColumn('type'), WorkspaceType::Personal->value)
                    ->where($this->qualifyColumn('owner_id'), $user->id);
            })->orWhereHas('memberships', fn (Builder $member) => $member->where('user_id', $user->id));
        });
    }

    /**
     * Eager-loads the membership row of $user as `membership` (one query for a list).
     *
     * @param  Builder<Workspace>  $query
     */
    public function scopeWithMembershipOf(Builder $query, User $user): void
    {
        $query->with(['membership' => fn (Relation $membership) => $membership->where('user_id', $user->id)]);
    }

    /**
     * @param  Builder<Workspace>  $query
     */
    public function scopeNotArchived(Builder $query): void
    {
        $query->whereNull($this->qualifyColumn('archived_at'));
    }

    /**
     * Direksi and Super Admin see every non-personal workspace.
     */
    public static function seesAllShared(User $user): bool
    {
        return $user->hasPermission(Permission::WorkspacesViewAll)
            || $user->hasPermission(Permission::WorkspacesManage);
    }

    /**
     * Stable owner key written to the Drive folder's appProperties.rk_owner.
     */
    public function driveFolderKey(): string
    {
        return 'workspaces:'.$this->id;
    }

    /**
     * "Proyek Peluncuran Q4 [PLQ]"; personal workspaces (all named "Pribadi")
     * carry the owner's name so the Shared Drive stays readable for admins:
     * "Pribadi · Dimas Pratama [DPR]".
     */
    public function driveFolderName(): string
    {
        $name = $this->name;

        if ($this->isPersonal()) {
            $owner = User::query()->whereKey($this->owner_id)->value('name');
            $name = is_string($owner) ? "{$this->name} · {$owner}" : $name;
        }

        return "{$name} [{$this->key}]";
    }

    /**
     * Workspace folders live at the root of the Shared Drive.
     */
    public function driveParentFolderId(): ?string
    {
        return null;
    }

    public function driveFolderId(): ?string
    {
        return $this->drive_folder_id;
    }

    /**
     * Saved quietly: no `updated` event (which would queue a folder rename).
     */
    public function storeDriveFolderId(?string $folderId): void
    {
        $this->forceFill(['drive_folder_id' => $folderId])->saveQuietly();
    }

    public function driveWorkspaceId(): string
    {
        return $this->id;
    }

    /**
     * Active members with their Drive role: owner/admin/member → writer,
     * viewer → reader (docs/ARCHITECTURE.md §3.6). Inactive employees lose
     * access on the next sync.
     *
     * @return list<DriveMember>
     */
    public function driveMembers(): array
    {
        return array_values(WorkspaceMember::query()
            ->where('workspace_id', $this->id)
            ->with('user:id,email,status')
            ->get()
            ->filter(fn (WorkspaceMember $member): bool => $member->user->isActive() && $member->user->email !== '')
            // Penugasan HR: the folder holds every employee's deliverables, so only HR admins get it.
            ->filter(fn (WorkspaceMember $member): bool => ! $this->tasks_private || $member->role->canManage())
            ->map(fn (WorkspaceMember $member): DriveMember => DriveMember::forWorkspaceRole($member->user->email, $member->role->value))
            ->all());
    }

    /**
     * @return HasMany<DriveFile, $this>
     */
    public function driveFiles(): HasMany
    {
        return $this->hasMany(DriveFile::class);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return BelongsTo<Division, $this>
     */
    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    /**
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return BelongsToMany<User, $this, WorkspaceMember, 'pivot'>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_members')
            ->using(WorkspaceMember::class)
            ->withPivot(['role', 'joined_at', 'is_synced', 'favorited_at'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<WorkspaceMember, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    /**
     * Membership of one user; constrain it with scopeWithMembershipOf().
     *
     * @return HasOne<WorkspaceMember, $this>
     */
    public function membership(): HasOne
    {
        return $this->hasOne(WorkspaceMember::class);
    }

    /**
     * Board columns in order.
     *
     * @return HasMany<TaskStatus, $this>
     */
    public function statuses(): HasMany
    {
        return $this->hasMany(TaskStatus::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<Label, $this>
     */
    public function labels(): HasMany
    {
        return $this->hasMany(Label::class)->orderBy('name');
    }

    /**
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /**
     * @return HasMany<Activity, $this>
     */
    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    /**
     * Project PIC (penanggung jawab).
     *
     * @return BelongsTo<User, $this>
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_user_id');
    }

    /**
     * Project sponsor (a Direksi member).
     *
     * @return BelongsTo<User, $this>
     */
    public function sponsor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sponsor_user_id');
    }

    /**
     * @return HasMany<Milestone, $this>
     */
    public function milestones(): HasMany
    {
        return $this->hasMany(Milestone::class)->orderBy('target_date')->orderBy('position');
    }

    /**
     * @return HasMany<ProjectUpdate, $this>
     */
    public function projectUpdates(): HasMany
    {
        return $this->hasMany(ProjectUpdate::class);
    }

    /**
     * @return HasMany<ProjectRisk, $this>
     */
    public function risks(): HasMany
    {
        return $this->hasMany(ProjectRisk::class);
    }

    /**
     * @return HasMany<ProjectDirection, $this>
     */
    public function directions(): HasMany
    {
        return $this->hasMany(ProjectDirection::class);
    }

    /**
     * @return HasMany<ProjectProgressSnapshot, $this>
     */
    public function progressSnapshots(): HasMany
    {
        return $this->hasMany(ProjectProgressSnapshot::class)->orderBy('date');
    }
}
