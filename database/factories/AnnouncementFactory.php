<?php

namespace Database\Factories;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Announcement>
 */
class AnnouncementFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'author_id' => fn (array $attributes): string => User::factory()->create(['company_id' => $attributes['company_id']])->id,
            'title' => 'Pengumuman '.fake()->word().' '.fake()->word(),
            'body' => fake()->paragraph(),
            'audience' => AnnouncementAudience::All,
            'target_ids' => [],
            'published_at' => now()->subMinute(),
            'expires_at' => null,
        ];
    }

    /**
     * @param  list<string>  $divisionIds
     */
    public function forDivisions(array $divisionIds): static
    {
        return $this->state(fn (): array => ['audience' => AnnouncementAudience::Division, 'target_ids' => $divisionIds]);
    }

    /**
     * @param  list<string>  $teamIds
     */
    public function forTeams(array $teamIds): static
    {
        return $this->state(fn (): array => ['audience' => AnnouncementAudience::Team, 'target_ids' => $teamIds]);
    }

    public function by(User $author): static
    {
        return $this->state(fn (): array => ['author_id' => $author->id, 'company_id' => $author->company_id]);
    }

    public function expired(): static
    {
        return $this->state(fn (): array => ['published_at' => now()->subDays(3), 'expires_at' => now()->subDay()]);
    }
}
