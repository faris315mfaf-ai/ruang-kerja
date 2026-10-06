<?php

namespace App\Models;

use App\Domain\Meetings\Enums\Rsvp;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Invitee of a meeting: an employee (`user_id`) or an external guest
 * (`email`, lower case) who only receives the invitation e-mail and never
 * sees anything in the app. The organizer is always a participant ("yes").
 *
 * @property string $id
 * @property string $meeting_id
 * @property string|null $user_id
 * @property string|null $email
 * @property Rsvp $rsvp
 * @property bool $optional
 * @property CarbonImmutable|null $responded_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Meeting $meeting
 * @property-read User|null $user
 */
#[Fillable(['meeting_id', 'user_id', 'email', 'rsvp', 'optional', 'responded_at'])]
class MeetingParticipant extends Model
{
    use HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'rsvp' => 'pending',
        'optional' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rsvp' => Rsvp::class,
            'optional' => 'boolean',
            'responded_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Meeting, $this>
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
