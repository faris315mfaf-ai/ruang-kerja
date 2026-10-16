<?php

namespace App\Models;

use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Enums\Rsvp;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Invitee of a meeting: an employee (`user_id`) or an external guest
 * (`email`, lower case) who never has an account and sees nothing of the app.
 * A guest of a video meeting joins through a personal link (/tamu/{token}) and
 * the waiting room (docs/sesi/rapat-tamu-eksternal.md); the token is not stored
 * (App\Domain\Meetings\Services\GuestLinks). The organizer is always a
 * participant ("yes").
 *
 * @property string $id
 * @property string $meeting_id
 * @property string|null $user_id
 * @property string|null $email
 * @property Rsvp $rsvp
 * @property bool $optional
 * @property CarbonImmutable|null $responded_at
 * @property string|null $guest_name
 * @property string|null $link_nonce
 * @property string|null $link_token_hash
 * @property CarbonImmutable|null $link_expires_at
 * @property CarbonImmutable|null $link_rotated_at
 * @property LobbyStatus $lobby_status
 * @property CarbonImmutable|null $lobby_occurrence_date
 * @property CarbonImmutable|null $lobby_requested_at
 * @property int $lobby_requests
 * @property string|null $lobby_ip
 * @property CarbonImmutable|null $admitted_at
 * @property string|null $admitted_by
 * @property CarbonImmutable|null $denied_at
 * @property string|null $denied_by
 * @property CarbonImmutable|null $removed_at
 * @property string|null $removed_by
 * @property CarbonImmutable|null $joined_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Meeting $meeting
 * @property-read User|null $user
 */
#[Fillable(['meeting_id', 'user_id', 'email', 'rsvp', 'optional', 'responded_at', 'guest_name'])]
#[Hidden(['link_nonce', 'link_token_hash', 'lobby_ip'])]
class MeetingParticipant extends Model
{
    use HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'rsvp' => 'pending',
        'optional' => false,
        'lobby_status' => 'none',
        'lobby_requests' => 0,
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
            'link_expires_at' => 'datetime',
            'link_rotated_at' => 'datetime',
            'lobby_status' => LobbyStatus::class,
            'lobby_occurrence_date' => 'date',
            'lobby_requested_at' => 'datetime',
            'lobby_requests' => 'integer',
            'admitted_at' => 'datetime',
            'denied_at' => 'datetime',
            'removed_at' => 'datetime',
            'joined_at' => 'datetime',
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

    public function isGuest(): bool
    {
        return $this->user_id === null && $this->email !== null;
    }
}
