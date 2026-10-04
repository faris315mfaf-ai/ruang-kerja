<?php

namespace App\Models;

use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $name
 * @property string $google_domain
 * @property string $timezone
 * @property array<string, mixed> $settings
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['name', 'google_domain', 'timezone', 'settings'])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'timezone' => 'Asia/Jakarta',
        'settings' => '{}',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    /**
     * Stored lower-case so login can compare it with the Google `hd` claim directly.
     *
     * @return Attribute<string, string>
     */
    protected function googleDomain(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => Str::lower(trim($value)));
    }

    /**
     * Whether an email address belongs to this company's Google Workspace domain.
     */
    public function ownsEmail(string $email): bool
    {
        return Str::lower(Str::afterLast(trim($email), '@')) === $this->google_domain;
    }

    /**
     * @return HasMany<Division, $this>
     */
    public function divisions(): HasMany
    {
        return $this->hasMany(Division::class);
    }

    /**
     * @return HasMany<Position, $this>
     */
    public function positions(): HasMany
    {
        return $this->hasMany(Position::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
