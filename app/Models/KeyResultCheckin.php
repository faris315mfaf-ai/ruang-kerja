<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\KeyResultCheckinFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Weekly progress check-in of a key result (append-only, docs/DATABASE.md §8).
 *
 * @property string $id
 * @property string $key_result_id
 * @property float $value
 * @property int|null $confidence 1–10
 * @property string|null $note
 * @property string|null $author_id
 * @property CarbonImmutable $checked_on office date
 * @property CarbonImmutable|null $created_at
 * @property-read KeyResult $keyResult
 * @property-read User|null $author
 */
#[Fillable(['key_result_id', 'value', 'confidence', 'note', 'author_id', 'checked_on'])]
class KeyResultCheckin extends Model
{
    /** @use HasFactory<KeyResultCheckinFactory> */
    use HasFactory, HasUlids;

    public const null UPDATED_AT = null;

    /** @var array<string, mixed> */
    protected $attributes = [
        'confidence' => null,
        'note' => null,
    ];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Key result check-ins are append-only.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'float',
            'confidence' => 'integer',
            'checked_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<KeyResult, $this>
     */
    public function keyResult(): BelongsTo
    {
        return $this->belongsTo(KeyResult::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
