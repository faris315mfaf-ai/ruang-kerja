<?php

namespace App\Domain\Devices\Models;

use App\Domain\Devices\Enums\DevicePlatform;
use App\Models\Company;
use App\Models\User;
use App\Policies\DevicePolicy;
use Carbon\CarbonImmutable;
use Database\Factories\DeviceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One installation of the app (phone or browser) that has signed in.
 * The raw device identifier is never stored — only its SHA-256 hash.
 *
 * @property string $id
 * @property string $user_id
 * @property string $company_id
 * @property DevicePlatform $platform
 * @property string $device_id_hash
 * @property string|null $name
 * @property string|null $os_version
 * @property string|null $app_version
 * @property string|null $push_token
 * @property array<string, mixed>|null $integrity_verdict
 * @property CarbonImmutable|null $last_seen_at
 * @property bool $biometric_login
 * @property bool $is_trusted
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read Company $company
 */
#[Fillable([
    'user_id',
    'company_id',
    'platform',
    'device_id_hash',
    'name',
    'os_version',
    'app_version',
    'push_token',
    'integrity_verdict',
    'last_seen_at',
    'biometric_login',
    'is_trusted',
])]
#[UseFactory(DeviceFactory::class)]
#[UsePolicy(DevicePolicy::class)]
class Device extends Model
{
    /** @use HasFactory<DeviceFactory> */
    use HasFactory, HasUlids;

    private const string TOKEN_PREFIX = 'device:';

    /**
     * Name every Sanctum token of this installation carries ("device:{id}").
     * The API login names its token this way, so a re-login can replace the
     * previous token of the same installation and revoking the device can
     * drop all of its tokens without extra schema.
     */
    public static function sanctumTokenName(string $deviceId): string
    {
        return self::TOKEN_PREFIX.$deviceId;
    }

    /**
     * The installation behind a Sanctum token named by sanctumTokenName(), or
     * null for any other token (or none). Always scoped to the token owner.
     */
    public static function forAccessToken(User $user): ?self
    {
        // At runtime the "current token" may be absent (session request) or a
        // TransientToken without a name, whatever the PHPDoc promises.
        $name = data_get($user->currentAccessToken(), 'name');

        if (! is_string($name) || ! str_starts_with($name, self::TOKEN_PREFIX)) {
            return null;
        }

        return self::query()
            ->where('user_id', $user->id)
            ->whereKey(substr($name, strlen(self::TOKEN_PREFIX)))
            ->first();
    }

    /**
     * Column defaults for new instances (synced with the migration), so fresh
     * in-memory models report false instead of null before being saved.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'biometric_login' => false,
        'is_trusted' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'platform' => DevicePlatform::class,
            'integrity_verdict' => 'array',
            'last_seen_at' => 'immutable_datetime',
            'biometric_login' => 'boolean',
            'is_trusted' => 'boolean',
        ];
    }

    /**
     * All devices of one user, most recently seen first.
     *
     * @param  Builder<Device>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('user_id'), $viewer->id)
            ->orderByDesc($this->qualifyColumn('last_seen_at'))
            ->orderByDesc($this->qualifyColumn('id'));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
