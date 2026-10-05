<?php

namespace App\Domain\Attendance\Models;

use App\Models\Company;
use App\Models\Concerns\Auditable;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\KioskFactory;
use Illuminate\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Lobby device that shows the dynamic QR code (docs/ARCHITECTURE.md §3.2).
 * Signs in through its own session guard `kiosk` and may only open its
 * kiosk page (App\Http\Middleware\RestrictKioskDevice).
 *
 * @property string $id
 * @property string $company_id
 * @property string $office_location_id
 * @property string $name
 * @property string $code
 * @property bool $is_active
 * @property string|null $activation_token_hash
 * @property CarbonImmutable|null $activation_expires_at
 * @property CarbonImmutable|null $activated_at
 * @property CarbonImmutable|null $last_seen_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 * @property-read OfficeLocation $officeLocation
 */
#[Fillable(['company_id', 'office_location_id', 'name', 'code', 'is_active'])]
#[Hidden(['activation_token_hash', 'remember_token'])]
#[UseFactory(KioskFactory::class)]
class Kiosk extends Model implements AuthenticatableContract
{
    /** @use HasFactory<KioskFactory> */
    use Auditable, Authenticatable, HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
        'activation_token_hash' => null,
        'activation_expires_at' => null,
        'activated_at' => null,
        'last_seen_at' => null,
        'remember_token' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'activation_expires_at' => 'immutable_datetime',
            'activated_at' => 'immutable_datetime',
            'last_seen_at' => 'immutable_datetime',
        ];
    }

    /**
     * Devices have no password; the guard never validates credentials.
     */
    public function getAuthPassword(): string
    {
        return '';
    }

    /**
     * @return list<string>
     */
    public function auditExclude(): array
    {
        return ['last_seen_at', 'remember_token', 'activation_token_hash'];
    }

    public function isPaired(): bool
    {
        return $this->activated_at !== null;
    }

    public function hasPendingActivation(?CarbonImmutable $now = null): bool
    {
        return $this->activation_token_hash !== null
            && $this->activation_expires_at !== null
            && $this->activation_expires_at->isAfter($now ?? CarbonImmutable::now());
    }

    public static function hashActivationToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * HR manages the kiosks of its own company.
     *
     * @param  Builder<Kiosk>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<OfficeLocation, $this>
     */
    public function officeLocation(): BelongsTo
    {
        return $this->belongsTo(OfficeLocation::class)->withTrashed();
    }
}
