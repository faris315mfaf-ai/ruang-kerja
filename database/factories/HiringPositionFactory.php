<?php

namespace Database\Factories;

use App\Domain\Hiring\Enums\PositionStatus;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Bypasses the Hiring Actions (no audit). Reviewers via interviewers()/approvers().
 *
 * @extends Factory<HiringPosition>
 */
class HiringPositionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'title' => 'Staf '.fake()->jobTitle(),
            'status' => PositionStatus::Open,
            'opened_at' => now(),
            'webhook_token' => Str::lower(Str::random(40)),
            'webhook_secret' => Str::random(48),
            'interviewer_ids' => [],
            'final_approver_ids' => [],
            'field_map' => [],
        ];
    }

    public function status(PositionStatus $status): static
    {
        return $this->state(fn (): array => [
            'status' => $status,
            'closed_at' => $status === PositionStatus::Closed ? now() : null,
        ]);
    }

    /**
     * @param  list<User>  $users
     */
    public function interviewers(array $users): static
    {
        return $this->state(fn (): array => ['interviewer_ids' => array_map(fn (User $user): string => $user->id, $users)]);
    }

    /**
     * @param  list<User>  $users
     */
    public function approvers(array $users): static
    {
        return $this->state(fn (): array => ['final_approver_ids' => array_map(fn (User $user): string => $user->id, $users)]);
    }
}
