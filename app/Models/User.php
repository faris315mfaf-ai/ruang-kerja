<?php

namespace App\Models;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\Theme;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Concerns\Auditable;
use Carbon\CarbonImmutable;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string|null $password
 * @property bool $password_change_required HR set a temporary password: change it before using the app
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $google_id
 * @property string|null $avatar_url
 * @property string|null $division_id
 * @property string|null $team_id
 * @property string|null $position_id
 * @property string|null $manager_id
 * @property WorkMode $work_mode
 * @property UserStatus $status
 * @property Carbon|null $joined_at
 * @property CarbonImmutable|null $deactivated_at set to inactive/resigned (cleared on reactivation)
 * @property Theme $theme
 * @property Carbon|null $last_login_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Company $company
 * @property-read Division|null $division
 * @property-read Team|null $team
 * @property-read Position|null $position
 * @property-read User|null $manager
 * @property-read EmployeeProfile|null $profile
 */
#[Fillable([
    'company_id', 'name', 'email', 'password', 'theme',
    'google_id', 'avatar_url', 'division_id', 'team_id', 'position_id', 'manager_id',
    'work_mode', 'status', 'joined_at', 'last_login_at',
])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'google_id'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use Auditable, HasFactory, HasRoles, HasUlids, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * Column defaults, mirroring the database. Nullable columns are listed too so
     * a freshly created (not re-fetched) model is complete under
     * Model::preventAccessingMissingAttributes() (strict mode outside production).
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'theme' => 'system',
        'work_mode' => 'office',
        'status' => 'active',
        'email_verified_at' => null,
        'two_factor_secret' => null,
        'two_factor_recovery_codes' => null,
        'two_factor_confirmed_at' => null,
        'remember_token' => null,
        'password_change_required' => false,
        'google_id' => null,
        'avatar_url' => null,
        'division_id' => null,
        'team_id' => null,
        'position_id' => null,
        'manager_id' => null,
        'joined_at' => null,
        'deactivated_at' => null,
        'last_login_at' => null,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_change_required' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
            'theme' => Theme::class,
            'work_mode' => WorkMode::class,
            'status' => UserStatus::class,
            'joined_at' => 'date',
            'deactivated_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    /**
     * Noise that is not master data (login bookkeeping, UI preference).
     *
     * @return list<string>
     */
    public function auditExclude(): array
    {
        return ['remember_token', 'last_login_at', 'theme', 'avatar_url'];
    }

    public function isActive(): bool
    {
        return $this->status->canSignIn();
    }

    /**
     * Permission check that never throws when the permission is not seeded yet.
     */
    public function hasPermission(Permission $permission): bool
    {
        return $this->checkPermissionTo($permission);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(Role::SuperAdmin);
    }

    /**
     * "Staf": holds only the `anggota` role, none of kepala_divisi, hr,
     * direksi or super_admin (keputusan pemilik 6 Okt 2026). Staff do not see
     * annual leave balances nor the org chart. A Ketua Tim (teams.lead_user_id)
     * without one of those roles is staff too. Mirrors isStaffOnly() in
     * resources/js/features/staff/roles.ts.
     */
    public function isStaffOnly(): bool
    {
        return ! $this->hasAnyRole(Role::aboveStaff());
    }

    /**
     * Per-instance memo of ledDivisionIds(), keyed by what it depends on locally.
     *
     * @var array{key: string, ids: list<string>}|null
     */
    private ?array $ledDivisionIdsMemo = null;

    /**
     * Divisions this user leads: those where they are `head_user_id`, plus their own
     * division when they hold the kepala_divisi role — including sub-divisions.
     *
     * Memoized on this instance (visibility scopes call it repeatedly per request);
     * recomputed when division_id or the kepala_divisi role changes, after refresh(),
     * or via forgetLedDivisionIds() when headships change elsewhere.
     *
     * @return list<string>
     */
    public function ledDivisionIds(): array
    {
        $leadsOwnDivision = $this->division_id !== null && $this->hasRole(Role::KepalaDivisi);
        $key = ($this->id ?? '').'|'.($this->division_id ?? '').'|'.($leadsOwnDivision ? '1' : '0');

        if ($this->ledDivisionIdsMemo !== null && $this->ledDivisionIdsMemo['key'] === $key) {
            return $this->ledDivisionIdsMemo['ids'];
        }

        /** @var list<string> $ids */
        $ids = Division::query()->where('head_user_id', $this->id)->pluck('id')->all();

        if ($leadsOwnDivision) {
            $ids[] = (string) $this->division_id;
        }

        $ids = $ids === [] ? [] : Division::withDescendantIds($ids);
        $this->ledDivisionIdsMemo = ['key' => $key, 'ids' => $ids];

        return $ids;
    }

    public function forgetLedDivisionIds(): void
    {
        $this->ledDivisionIdsMemo = null;
    }

    /**
     * Reload the model from the database (also drops the ledDivisionIds() memo).
     *
     * @return $this
     */
    public function refresh()
    {
        $this->forgetLedDivisionIds();

        return parent::refresh();
    }

    /**
     * Data scope for people (docs/ARCHITECTURE.md §4): self, direct reports, whole
     * division(s) the viewer leads, or everyone in the company with employees.view
     * (HR, Direksi, Super Admin). Always limited to the viewer's company.
     *
     * @param  Builder<User>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);

        if ($viewer->hasPermission(Permission::EmployeesView)) {
            return;
        }

        $divisionIds = $viewer->ledDivisionIds();

        $query->where(function (Builder $scope) use ($viewer, $divisionIds): void {
            $scope->where($this->qualifyColumn('id'), $viewer->id)
                ->orWhere($this->qualifyColumn('manager_id'), $viewer->id);

            if ($divisionIds !== []) {
                $scope->orWhereIn($this->qualifyColumn('division_id'), $divisionIds);
            }
        });
    }

    /**
     * @param  Builder<User>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where($this->qualifyColumn('status'), UserStatus::Active->value);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
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
     * @return BelongsTo<Position, $this>
     */
    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    /**
     * Atasan langsung (first approver).
     *
     * @return BelongsTo<User, $this>
     */
    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    /**
     * @return HasMany<User, $this>
     */
    public function directReports(): HasMany
    {
        return $this->hasMany(User::class, 'manager_id');
    }

    /**
     * @return HasOne<EmployeeProfile, $this>
     */
    public function profile(): HasOne
    {
        return $this->hasOne(EmployeeProfile::class);
    }

    /**
     * Divisions where this user is the Kepala Divisi.
     *
     * @return HasMany<Division, $this>
     */
    public function ledDivisions(): HasMany
    {
        return $this->hasMany(Division::class, 'head_user_id');
    }

    /**
     * Teams where this user is the Ketua Tim.
     *
     * @return HasMany<Team, $this>
     */
    public function ledTeams(): HasMany
    {
        return $this->hasMany(Team::class, 'lead_user_id');
    }
}
