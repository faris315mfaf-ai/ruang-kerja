<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Guests\GuestNames;
use App\Domain\Meetings\Guests\Jobs\RemoveGuestsFromRooms;
use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;

/**
 * Adds and removes participants. Only active employees of the meeting's
 * company are added (ids from other companies are ignored); guests are
 * stored by lower-case e-mail. `invited()` lists the employees of a meeting
 * (organizer, minute taker, internal participants) from loaded relations.
 */
final class MeetingParticipants
{
    public function __construct(private readonly GuestLinks $links) {}

    /**
     * @param  list<string>  $userIds
     * @return list<User> users that were newly added
     */
    public function add(Meeting $meeting, array $userIds, Rsvp $rsvp = Rsvp::Pending): array
    {
        $ids = array_values(array_unique($userIds));

        if ($ids === []) {
            return [];
        }

        $existing = MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereIn('user_id', $ids)->pluck('user_id')->all();
        $users = User::query()
            ->where('company_id', $meeting->company_id)
            ->where('status', UserStatus::Active->value)
            ->whereIn('id', array_diff($ids, $existing))
            ->get();
        $now = now();

        foreach ($users as $user) {
            MeetingParticipant::query()->create([
                'meeting_id' => $meeting->id,
                'user_id' => $user->id,
                'rsvp' => $rsvp,
                'responded_at' => $rsvp === Rsvp::Pending ? null : $now,
            ]);
        }

        return array_values($users->all());
    }

    /**
     * Adds external guests by e-mail (an optional display name per e-mail) and
     * gives each a personal link (GuestLinks). Existing guests keep their link;
     * a name given again replaces the stored one.
     *
     * @param  list<string>  $emails
     * @param  array<string, string|null>  $names  lower-case e-mail => name
     * @return list<MeetingParticipant> the guests (new and existing)
     */
    public function addGuests(Meeting $meeting, array $emails, array $names = []): array
    {
        $byEmail = [];

        foreach ($names as $email => $name) {
            $byEmail[mb_strtolower(trim((string) $email))] = $name;
        }

        $guests = [];

        foreach (array_unique(array_map(fn (string $email): string => mb_strtolower(trim($email)), $emails)) as $email) {
            if ($email === '') {
                continue;
            }

            $name = GuestNames::clean($byEmail[$email] ?? null);
            $guest = MeetingParticipant::query()->firstOrCreate(['meeting_id' => $meeting->id, 'email' => $email], ['guest_name' => $name]);

            if (! $guest->wasRecentlyCreated && $name !== null && $guest->guest_name !== $name) {
                $guest->forceFill(['guest_name' => $name])->save();
            }

            $guests[] = $this->links->ensure($guest, $meeting);
        }

        return $guests;
    }

    /**
     * Keeps exactly these participants (the organizer always stays).
     *
     * @param  list<string>  $userIds
     * @param  list<string>  $emails
     * @param  array<string, string|null>  $guestNames  lower-case e-mail => name
     * @return list<User> users that were newly added
     */
    public function sync(Meeting $meeting, array $userIds, array $emails, array $guestNames = []): array
    {
        $keep = array_values(array_unique([$meeting->organizer_id, ...$userIds]));
        $guests = array_values(array_unique(array_map(fn (string $email): string => mb_strtolower(trim($email)), $emails)));

        MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNotNull('user_id')->whereNotIn('user_id', $keep)->delete();
        $dropped = MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNotNull('email')->whereNotIn('email', $guests === [] ? [''] : $guests);
        // Guests taken off the list leave the live video room too (links die with the row).
        RemoveGuestsFromRooms::forParticipants($meeting, array_values($dropped->pluck('id')->map(strval(...))->all()));
        $dropped->delete();

        $added = $this->add($meeting, $keep);
        $this->addGuests($meeting, $guests, $guestNames);
        $meeting->unsetRelation('participants');

        return $added;
    }

    /**
     * Invited employees: organizer, minute taker, then internal participants
     * in their stored order (guests by e-mail are not included). Uses the
     * loaded `participants` relation; no query when it is loaded.
     *
     * @return list<array{user_id: string, rsvp: string, optional: bool}>
     */
    public function invited(Meeting $meeting): array
    {
        $result = [];
        $byUser = [];

        foreach ($meeting->participants as $participant) {
            if ($participant->user_id !== null) {
                $byUser[(string) $participant->user_id] = $participant;
            }
        }

        $ids = array_values(array_unique(array_filter([
            $meeting->organizer_id,
            $meeting->minute_taker_id,
            ...array_keys($byUser),
        ], fn (?string $id): bool => $id !== null && $id !== '')));

        foreach ($ids as $id) {
            $participant = $byUser[$id] ?? null;
            $result[] = [
                'user_id' => $id,
                'rsvp' => $participant !== null ? $participant->rsvp->value : ($id === $meeting->organizer_id ? Rsvp::Yes->value : Rsvp::Pending->value),
                'optional' => $participant !== null && $participant->optional,
            ];
        }

        return $result;
    }
}
