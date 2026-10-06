<?php

namespace Database\Factories;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Models\Channel;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses the chat Actions (no events). Members are added with
 * `withMembers()` (first = owner).
 *
 * @extends Factory<Channel>
 */
class ChannelFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'type' => ChannelType::Public,
            'name' => fake()->unique()->slug(2),
            'topic' => null,
        ];
    }

    public function publicChannel(): static
    {
        return $this->state(fn (): array => ['type' => ChannelType::Public]);
    }

    public function privateChannel(): static
    {
        return $this->state(fn (): array => ['type' => ChannelType::Private]);
    }

    public function forWorkspace(Workspace $workspace): static
    {
        return $this->state(fn (): array => [
            'company_id' => $workspace->company_id,
            'workspace_id' => $workspace->id,
            'type' => ChannelType::Workspace,
            'name' => $workspace->name,
        ]);
    }

    /**
     * DM (2 people) or group (3+), keyed by its members.
     *
     * @param  list<User>  $users
     */
    public function direct(array $users): static
    {
        $ids = array_map(fn (User $user): string => $user->id, $users);

        return $this->state(fn (): array => [
            'company_id' => $users[0]->company_id,
            'type' => count($ids) > 2 ? ChannelType::Group : ChannelType::Dm,
            'name' => null,
            'direct_key' => Channel::directKey($ids),
        ])->withMembers($users);
    }

    /**
     * @param  list<User>  $users  first one is the owner
     */
    public function withMembers(array $users): static
    {
        return $this->afterCreating(function (Channel $channel) use ($users): void {
            foreach ($users as $index => $user) {
                $channel->memberships()->getQuery()->insertOrIgnore([
                    'channel_id' => $channel->id,
                    'user_id' => $user->id,
                    'role' => ($index === 0 ? ChannelRole::Owner : ChannelRole::Member)->value,
                    'muted' => false,
                    'joined_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });
    }
}
