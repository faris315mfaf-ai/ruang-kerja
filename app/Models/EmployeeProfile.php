<?php

namespace App\Models;

use Database\Factories\EmployeeProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Personal data of an employee (1:1 with users, PK = user_id). Never log `nik`.
 *
 * @property string $user_id
 * @property string $company_id
 * @property string|null $employee_number
 * @property string|null $nik
 * @property string|null $phone
 * @property Carbon|null $birth_date
 * @property string|null $address
 * @property array{name?: string, relation?: string, phone?: string}|null $emergency_contact
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'company_id', 'employee_number', 'nik', 'phone', 'birth_date', 'address', 'emergency_contact'])]
#[Hidden(['nik'])]
class EmployeeProfile extends Model
{
    /** @use HasFactory<EmployeeProfileFactory> */
    use HasFactory;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected static function booted(): void
    {
        // Denormalised from the user (Fase 1 multi-perusahaan): employee
        // numbers are unique per company.
        static::creating(function (self $profile): void {
            if (($profile->getAttributes()['company_id'] ?? null) === null) {
                $company = User::query()->whereKey($profile->user_id)->value('company_id');
                $profile->company_id = is_string($company) ? $company : null;
            }
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'nik' => 'encrypted',
            'birth_date' => 'date',
            'emergency_contact' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
