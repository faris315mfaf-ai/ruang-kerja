<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Services\ChannelMembership;
use App\Domain\Organization\Enums\UserStatus;
use App\Events\Chat\ChatActivity;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates a free channel: public (every employee reads it) or private
 * (members only). The creator is the owner; invited people must be active
 * employees of the same company.
 */
final class CreateChannel
{
    public function __construct(private readonly ChannelMembership $membership) {}

    /**
     * @param  array{name: string, topic?: string|null, private?: bool, member_ids?: list<string>}  $data
     */
    public function handle(User $creator, array $data): Channel
    {
        $name = self::normalizeName($data['name']);

        if (mb_strlen($name) < 2) {
            throw ValidationException::withMessages(['name' => 'Nama channel minimal 2 karakter.']);
        }

        $memberIds = User::query()
            ->whereIn('id', $data['member_ids'] ?? [])
            ->where('company_id', $creator->company_id)
            ->where('status', UserStatus::Active)
            ->where('id', '!=', $creator->id)
            ->pluck('id')
            ->all();

        $channel = DB::transaction(function () use ($creator, $data, $name, $memberIds): Channel {
            $channel = Channel::query()->create([
                'company_id' => $creator->company_id,
                'type' => ($data['private'] ?? false) ? ChannelType::Private : ChannelType::Public,
                'name' => $name,
                'topic' => self::normalizeTopic($data['topic'] ?? null),
                'created_by' => $creator->id,
            ]);

            $this->membership->add($channel, [
                $creator->id => ChannelRole::Owner,
                ...array_fill_keys($memberIds, ChannelRole::Member),
            ]);

            return $channel;
        });

        ChatActivity::dispatch($channel, array_values(array_map('strval', $memberIds)));

        return $channel;
    }

    /** "Tim Konten Q4" → "tim-konten-q4" (same rule as the composer preview). */
    public static function normalizeName(string $name): string
    {
        $slug = mb_strtolower(trim($name));
        $slug = (string) preg_replace('/[^\p{L}\p{N}]+/u', '-', $slug);

        return mb_substr(trim($slug, '-'), 0, 40);
    }

    private static function normalizeTopic(?string $topic): ?string
    {
        $topic = trim((string) $topic);

        return $topic === '' ? null : mb_substr($topic, 0, 250);
    }
}
