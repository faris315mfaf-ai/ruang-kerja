<?php

namespace App\Domain\Search\Actions;

use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Services\SearchRegistry;
use App\Models\User;

/**
 * Runs every registered provider (or only $group) for the viewer and returns
 * non-empty groups in registry order.
 */
final class RunSearch
{
    public function __construct(private readonly SearchRegistry $registry) {}

    /**
     * @return list<array{key: string, label: string, items: list<array<string, string|bool|null>>}>
     */
    public function handle(User $viewer, string $query, ?string $group = null): array
    {
        $query = trim($query);
        $limit = $group === null
            ? config()->integer('search.limit', 5)
            : config()->integer('search.group_limit', 20);
        $groups = [];

        foreach ($this->registry->all() as $provider) {
            if ($group !== null && $provider->key() !== $group) {
                continue;
            }

            if (mb_strlen($query) < $provider->minQueryLength()) {
                continue;
            }

            $items = array_slice($provider->search($viewer, $query, $limit), 0, $limit);

            if ($items === []) {
                continue;
            }

            $groups[] = [
                'key' => $provider->key(),
                'label' => $provider->label(),
                'items' => array_map(fn (SearchResult $result): array => $result->toArray(), $items),
            ];
        }

        return $groups;
    }
}
