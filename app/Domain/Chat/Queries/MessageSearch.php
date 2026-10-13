<?php

namespace App\Domain\Chat\Queries;

use App\Models\Channel;
use App\Models\Message;
use Illuminate\Database\Eloquent\Collection;

/**
 * Full-text search inside one channel on messages.search_vector (config
 * `simple`, no Indonesian stemmer): every typed word matches as a prefix, so
 * live typing works. Deleted messages never match. Newest first, paged with
 * `$before` (message id).
 */
final class MessageSearch
{
    public const int PAGE = 20;

    public const int MIN_LENGTH = 2;

    /**
     * @return array{messages: Collection<int, Message>, has_more: bool}
     */
    public function handle(Channel $channel, string $term, ?string $before = null): array
    {
        $query = $this->tsQuery($term);

        if ($query === null) {
            return ['messages' => new Collection, 'has_more' => false];
        }

        $found = Message::query()
            ->where('channel_id', $channel->id)
            ->whereRaw("messages.search_vector @@ to_tsquery('simple', ?)", [$query])
            ->when($before !== null, fn ($builder) => $builder->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::PAGE + 1)
            ->get();

        return ['messages' => $found->take(self::PAGE)->values(), 'has_more' => $found->count() > self::PAGE];
    }

    /**
     * "rapat  PLQ-18" → "rapat:* & plq:* & 18:*" (letters and digits only, so
     * nothing a user types can break the tsquery syntax).
     */
    private function tsQuery(string $term): ?string
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($term), -1, PREG_SPLIT_NO_EMPTY);
        $words = array_slice($words === false ? [] : $words, 0, 6);

        return $words === [] ? null : implode(' & ', array_map(fn (string $word): string => $word.':*', $words));
    }
}
