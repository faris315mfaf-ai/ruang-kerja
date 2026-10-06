<?php

namespace Database\Factories;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses the meeting Actions (no notifications). The organizer becomes a
 * participant ("yes") automatically; add others with `withParticipants()`.
 *
 * @extends Factory<Meeting>
 */
class MeetingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = CarbonImmutable::now(config()->string('app.office_timezone'))->addDay()->setTime(10, 0);

        return [
            'company_id' => fn (array $attributes): string => User::query()->whereKey($attributes['organizer_id'])->value('company_id') ?? CompanyFactory::defaultId(),
            'organizer_id' => User::factory(),
            'title' => 'Rapat '.fake()->word().' '.fake()->word(),
            'starts_at' => $start->utc(),
            'ends_at' => $start->addHour()->utc(),
            'platform' => MeetingPlatform::Meet,
            'join_url' => 'https://meet.google.com/abc-defg-hij',
            'agenda' => ['Pembukaan', 'Pembahasan'],
            'recurrence' => Recurrence::None,
            'reminders' => [15, 5],
        ];
    }

    public function by(User $organizer): static
    {
        return $this->state(fn (): array => ['organizer_id' => $organizer->id, 'company_id' => $organizer->company_id]);
    }

    /** Starts at an office-time instant ("2026-10-05 09:00"), lasting `$minutes`. */
    public function at(string $officeTime, int $minutes = 60): static
    {
        $start = CarbonImmutable::parse($officeTime, config()->string('app.office_timezone'));

        return $this->state(fn (): array => ['starts_at' => $start->utc(), 'ends_at' => $start->addMinutes($minutes)->utc()]);
    }

    public function recurring(Recurrence $recurrence, ?string $until = null): static
    {
        return $this->state(fn (): array => ['recurrence' => $recurrence, 'recurrence_until' => $until]);
    }

    public function leadership(): static
    {
        return $this->state(fn (): array => ['leadership' => true]);
    }

    /**
     * @param  list<User>  $users
     */
    public function withParticipants(array $users, Rsvp $rsvp = Rsvp::Pending): static
    {
        return $this->afterCreating(function (Meeting $meeting) use ($users, $rsvp): void {
            foreach ($users as $user) {
                MeetingParticipant::query()->firstOrCreate(
                    ['meeting_id' => $meeting->id, 'user_id' => $user->id],
                    ['rsvp' => $rsvp],
                );
            }
        });
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Meeting $meeting): void {
            MeetingParticipant::query()->firstOrCreate(
                ['meeting_id' => $meeting->id, 'user_id' => $meeting->organizer_id],
                ['rsvp' => Rsvp::Yes, 'responded_at' => now()],
            );
        });
    }
}
