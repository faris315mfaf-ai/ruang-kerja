<?php

namespace App\Models;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "Lupa kata sandi" request that HR approves or rejects (owner decision 6 Oct 2026).
 *
 * @property string $id
 * @property string|null $company_id
 * @property string|null $user_id
 * @property string $email
 * @property string $request_token_hash
 * @property string|null $setup_token_hash
 * @property PasswordResetStatus $status
 * @property string|null $decided_by
 * @property CarbonImmutable|null $decided_at
 * @property string|null $reject_reason
 * @property CarbonImmutable $expires_at
 * @property string|null $ip
 * @property string|null $user_agent
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User|null $user
 * @property-read User|null $decider
 */
#[Fillable([
    'company_id', 'user_id', 'email', 'request_token_hash', 'setup_token_hash', 'status',
    'decided_by', 'decided_at', 'reject_reason', 'expires_at', 'ip', 'user_agent',
])]
#[Hidden(['request_token_hash', 'setup_token_hash'])]
class PasswordResetRequest extends Model
{
    use HasUlids;

    /** A request waits at most this long for HR. */
    public const int PENDING_HOURS = 24;

    /** After approval, the new password must be set within this window. */
    public const int SETUP_MINUTES = 30;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'pending',
        'setup_token_hash' => null,
        'decided_by' => null,
        'decided_at' => null,
        'reject_reason' => null,
        'ip' => null,
        'user_agent' => null,
    ];

    protected function casts(): array
    {
        return [
            'status' => PasswordResetStatus::class,
            'decided_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Requests the viewer may see and decide: employees.manage in the same
     * company; a Super Admin's request only for other Super Admins.
     *
     * @param  Builder<PasswordResetRequest>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        if (! $viewer->hasPermission(Permission::EmployeesManage)) {
            $query->whereRaw('false');

            return;
        }

        $query->where($this->qualifyColumn('company_id'), $viewer->company_id)
            ->where(fn (Builder $own) => $own->whereNull($this->qualifyColumn('user_id'))->orWhere($this->qualifyColumn('user_id'), '<>', $viewer->id));

        if (! $viewer->isSuperAdmin()) {
            $query->whereDoesntHave('user.roles', fn (Builder $roles) => $roles->where('name', Role::SuperAdmin->value));
        }
    }

    /**
     * Pending and not yet past its 24-hour window.
     *
     * @param  Builder<PasswordResetRequest>  $query
     */
    public function scopeAwaitingDecision(Builder $query): void
    {
        $query->where($this->qualifyColumn('status'), PasswordResetStatus::Pending->value)
            ->where($this->qualifyColumn('expires_at'), '>', CarbonImmutable::now());
    }

    public function isAwaitingDecision(): bool
    {
        return $this->status === PasswordResetStatus::Pending && $this->expires_at->isFuture();
    }

    /**
     * End of the window to set the new password (approved requests only).
     */
    public function setupExpiresAt(): ?CarbonImmutable
    {
        return $this->decided_at?->addMinutes(self::SETUP_MINUTES);
    }

    /**
     * Approved and still inside the 30-minute setup window.
     */
    public function canBeCompleted(): bool
    {
        $deadline = $this->setupExpiresAt();

        return $this->status === PasswordResetStatus::Approved && $deadline !== null && $deadline->isFuture();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
