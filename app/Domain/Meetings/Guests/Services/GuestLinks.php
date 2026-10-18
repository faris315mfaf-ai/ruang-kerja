<?php

namespace App\Domain\Meetings\Guests\Services;

use App\Domain\Meetings\Enums\LobbyStatus;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use Carbon\CarbonImmutable;

/**
 * Personal links of external guests: https://{host}/tamu/{token}.
 *
 * The token is never stored. It is `{participant id}{HMAC}`: the 26-character
 * lower-case ULID of the guest's meeting_participants row followed by 32
 * base64url characters of HMAC-SHA256(APP_KEY, "guest-link|id|link_nonce").
 * So the organizer can copy the link again any time, rotating it (a new
 * `link_nonce`) kills the old one, and the database only holds `link_nonce`
 * and the SHA-256 of the token (`link_token_hash`, the lookup key): a copy of
 * the table alone yields no usable link. Rotating APP_KEY invalidates every
 * guest link; the next organizer listing refreshes the stored hashes.
 *
 * A link is valid until `link_expires_at`: the end of the join window of the
 * meeting's last occurrence, at most `livekit.guest_link_max_days` ahead for
 * open-ended series.
 */
final class GuestLinks
{
    /** ULID + 32 base64url characters. */
    public const string PATTERN = '[0-9a-hjkmnp-tv-z]{26}[A-Za-z0-9_-]{32}';

    public function looksValid(string $token): bool
    {
        return preg_match('/^'.self::PATTERN.'$/', $token) === 1;
    }

    /** Creates the nonce / hash / expiry of a guest that has none yet (also heals a stale hash). */
    public function ensure(MeetingParticipant $guest, Meeting $meeting): MeetingParticipant
    {
        if ($guest->link_nonce === null) {
            $guest->forceFill(['link_nonce' => bin2hex(random_bytes(16))]);
        }

        $hash = self::hash($this->token($guest));
        $changes = $guest->link_token_hash !== $hash || $guest->link_expires_at === null;

        if ($changes) {
            $guest->forceFill([
                'link_token_hash' => $hash,
                'link_expires_at' => $guest->link_expires_at ?? $this->expiresAt($meeting),
            ])->save();
        }

        return $guest;
    }

    /**
     * New link: old one stops working at once, waiting room state is cleared.
     */
    public function rotate(MeetingParticipant $guest, Meeting $meeting, ?CarbonImmutable $now = null): MeetingParticipant
    {
        $guest->forceFill([
            'link_nonce' => bin2hex(random_bytes(16)),
            'link_rotated_at' => $now ?? CarbonImmutable::now(),
            'link_expires_at' => $this->expiresAt($meeting, $now),
            'lobby_status' => LobbyStatus::None,
            'lobby_occurrence_date' => null,
            'lobby_requested_at' => null,
            'admitted_at' => null,
            'admitted_by' => null,
            'denied_at' => null,
            'denied_by' => null,
            'removed_at' => null,
            'removed_by' => null,
            'joined_at' => null,
        ]);
        $guest->forceFill(['link_token_hash' => self::hash($this->token($guest))])->save();

        return $guest;
    }

    /** The secret path segment. Requires a nonce (call ensure() first). */
    public function token(MeetingParticipant $guest): string
    {
        $id = strtolower((string) $guest->id);
        $mac = hash_hmac('sha256', 'guest-link|'.$id.'|'.$guest->link_nonce, $this->key(), true);

        return $id.substr(rtrim(strtr(base64_encode($mac), '+/', '-_'), '='), 0, 32);
    }

    public function url(MeetingParticipant $guest): string
    {
        return route('meetings.guest.page', ['token' => $this->token($guest)]);
    }

    /** The guest row behind a token, or null (unknown, rotated, not a guest). */
    public function resolve(string $token): ?MeetingParticipant
    {
        if (! $this->looksValid($token)) {
            return null;
        }

        $guest = MeetingParticipant::query()
            ->where('link_token_hash', self::hash($token))
            ->whereNull('user_id')
            ->whereNotNull('email')
            ->with('meeting')
            ->first();

        // Defence in depth: the token must also match the HMAC of the row.
        // A soft-deleted meeting has no `meeting` any more: the link is dead.
        return $guest !== null && $guest->getRelationValue('meeting') instanceof Meeting && $guest->link_nonce !== null && hash_equals($this->token($guest), $token) ? $guest : null;
    }

    public function expiresAt(Meeting $meeting, ?CarbonImmutable $now = null): CarbonImmutable
    {
        $now ??= CarbonImmutable::now();
        $cap = $now->addDays(max(1, (int) config('livekit.guest_link_max_days', 60)));
        $timezone = config()->string('app.office_timezone');
        $after = max(0, (int) config('livekit.join_after_minutes', 120));

        if (! $meeting->isRecurring()) {
            return $meeting->ends_at->addMinutes($after);
        }

        if ($meeting->recurrence_until === null) {
            return $cap;
        }

        $last = CarbonImmutable::parse($meeting->recurrence_until->toDateString(), $timezone)->endOfDay()->addMinutes($after);

        return $last->lt($cap) ? $last : $cap;
    }

    /** After a time change: every guest link follows the new schedule. */
    public function refreshExpiry(Meeting $meeting): void
    {
        MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->whereNull('user_id')
            ->whereNotNull('link_nonce')
            ->update(['link_expires_at' => $this->expiresAt($meeting)]);
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    private function key(): string
    {
        return (string) config('app.key');
    }
}
