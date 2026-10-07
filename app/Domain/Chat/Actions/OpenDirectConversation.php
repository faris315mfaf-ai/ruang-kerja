<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Services\ChannelMembership;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Opens the DM (2 people) or group (3+) of exactly these people, creating it
 * the first time. The same set of people always gets the same conversation
 * (channels.direct_key), even when two people open it at the same moment.
 */
final class OpenDirectConversation
{
    public const int MAX_PEOPLE = 9;

    public function __construct(private readonly ChannelMembership $membership) {}

    /**
     * @param  list<string>  $userIds  the other people
     */
    public function handle(User $actor, array $userIds): Channel
    {
        $others = User::query()
            ->whereIn('id', array_values(array_unique($userIds)))
            ->where('company_id', $actor->company_id)
            ->where('status', UserStatus::Active)
            ->where('id', '!=', $actor->id)
            ->pluck('id')
            ->all();

        if ($others === []) {
            throw ValidationException::withMessages(['user_ids' => 'Pilih minimal satu orang.']);
        }

        if (count($others) + 1 > self::MAX_PEOPLE) {
            throw ValidationException::withMessages(['user_ids' => 'Grup maksimal '.self::MAX_PEOPLE.' orang. Buat channel untuk tim yang lebih besar.']);
        }

        $memberIds = array_values([$actor->id, ...array_map('strval', $others)]);
        $key = Channel::directKey($memberIds);

        $existing = $this->find($actor, $key);

        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::transaction(function () use ($actor, $memberIds, $key): Channel {
                $channel = Channel::query()->create([
                    'company_id' => $actor->company_id,
                    'type' => count($memberIds) > 2 ? ChannelType::Group : ChannelType::Dm,
                    'name' => null,
                    'direct_key' => $key,
                    'created_by' => $actor->id,
                ]);

                $this->membership->add($channel, array_fill_keys($memberIds, ChannelRole::Member));

                return $channel;
            });
        } catch (UniqueConstraintViolationException) {
            // Opened by someone else in the meantime: reuse theirs.
            return $this->find($actor, $key) ?? throw ValidationException::withMessages(['user_ids' => 'Coba lagi.']);
        }
    }

    private function find(User $actor, string $key): ?Channel
    {
        return Channel::query()
            ->where('company_id', $actor->company_id)
            ->where('direct_key', $key)
            ->first();
    }
}
