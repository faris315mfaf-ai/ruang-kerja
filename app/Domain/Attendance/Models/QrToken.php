<?php

namespace App\Domain\Attendance\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A QR code a kiosk displayed for one 30-second window (docs/DATABASE.md §2).
 * Only the SHA-256 of the HMAC is stored.
 *
 * @property string $id
 * @property string $office_location_id
 * @property string|null $kiosk_id
 * @property string $token_hash
 * @property int $window
 * @property CarbonImmutable $valid_from
 * @property CarbonImmutable $valid_until
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read OfficeLocation $officeLocation
 * @property-read Kiosk|null $kiosk
 */
#[Fillable(['office_location_id', 'kiosk_id', 'token_hash', 'window', 'valid_from', 'valid_until'])]
class QrToken extends Model
{
    use HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'kiosk_id' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'window' => 'integer',
            'valid_from' => 'immutable_datetime',
            'valid_until' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<OfficeLocation, $this>
     */
    public function officeLocation(): BelongsTo
    {
        return $this->belongsTo(OfficeLocation::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Kiosk, $this>
     */
    public function kiosk(): BelongsTo
    {
        return $this->belongsTo(Kiosk::class)->withTrashed();
    }
}
