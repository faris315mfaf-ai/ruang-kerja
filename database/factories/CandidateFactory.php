<?php

namespace Database\Factories;

use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Models\Candidate;
use App\Models\HiringPosition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses CreateCandidate: no checklist items unless withChecklist() (which
 * runs the real CandidateChecklist seeding).
 *
 * @extends Factory<Candidate>
 */
class CandidateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'position_id' => HiringPosition::factory(),
            'company_id' => fn (array $attributes): string => HiringPosition::query()->whereKey($attributes['position_id'])->valueOrFail('company_id'),
            'full_name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '08'.fake()->numerify('##########'),
            'cv_url' => 'https://drive.google.com/open?id='.fake()->bothify('????????##'),
            'attachments' => [],
            'form_answers' => [],
            'stage' => CandidateStage::Applied,
            'source' => CandidateSource::Manual,
            'applied_at' => now(),
        ];
    }

    public function forPosition(HiringPosition $position): static
    {
        return $this->state(fn (): array => ['position_id' => $position->id, 'company_id' => $position->company_id]);
    }

    public function stage(CandidateStage $stage): static
    {
        return $this->state(fn (): array => ['stage' => $stage]);
    }

    public function withChecklist(): static
    {
        return $this->afterCreating(function (Candidate $candidate): void {
            app(CandidateChecklist::class)->seed($candidate, $candidate->hiringPosition()->firstOrFail());
        });
    }
}
