<?php

namespace App\Domain\Search\Actions;

use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Services\SearchRegistry;
use App\Models\User;

/**
 * Global search for the mobile app: runs the same registry providers as the
 * web command palette (each filters by the viewer's visibility), minus the
 * client-side "Aksi" group, and gives every hit a `target` the app can open.
 */
final class RunApiSearch
{
    /** API group key => provider key. */
    public const array GROUPS = [
        'tugas' => 'tasks',
        'orang' => 'people',
        'workspace' => 'workspaces',
        'dokumen' => 'documents',
        'catatan' => 'notes',
        'pengajuan' => 'requests',
        'rapat' => 'meetings',
    ];

    /** Accepted values of `tipe`. */
    public const array TYPES = ['tugas', 'orang', 'workspace', 'dokumen', 'catatan', 'pengajuan', 'rapat'];

    public function __construct(private readonly SearchRegistry $registry) {}

    /**
     * @return list<array{key: string, label: string, has_more: bool, items: list<array<string, mixed>>}>
     */
    public function handle(User $viewer, string $query, ?string $type = null): array
    {
        $query = trim($query);
        $limit = $type === null
            ? config()->integer('search.limit', 5)
            : config()->integer('search.group_limit', 20);
        $providerKeys = array_flip(self::GROUPS);
        $groups = [];

        foreach ($this->registry->all() as $provider) {
            $key = $providerKeys[$provider->key()] ?? null;

            if ($key === null || ($type !== null && $type !== $key) || mb_strlen($query) < $provider->minQueryLength()) {
                continue;
            }

            // One extra row tells whether "more" exists beyond the page.
            $found = $provider->search($viewer, $query, $limit + 1);

            if ($found === []) {
                continue;
            }

            $groups[] = [
                'key' => $key,
                'label' => $provider->label(),
                'has_more' => count($found) > $limit,
                'items' => array_map(fn (SearchResult $result): array => $this->item($result, $key), array_slice($found, 0, $limit)),
            ];
        }

        return $groups;
    }

    /**
     * @return array<string, mixed>
     */
    private function item(SearchResult $result, string $group): array
    {
        $recordId = str_contains($result->id, ':') ? substr($result->id, (int) strpos($result->id, ':') + 1) : $result->id;
        $type = match ($group) {
            'pengajuan' => str_starts_with((string) $result->url, '/persetujuan/') ? 'persetujuan' : 'pengajuan',
            default => $group,
        };

        return [
            'id' => $result->id,
            'title' => $result->title,
            'code' => $result->code,
            'subtitle' => $result->subtitle,
            'meta' => $result->meta,
            'snippet' => $result->snippet,
            'avatar' => $result->avatar,
            'icon' => $result->icon,
            'url' => $result->url,
            'external' => $result->external,
            // Files open in Google (url); every other hit opens an app screen.
            'target' => ['type' => $type, 'id' => $recordId, 'anchor' => null, 'params' => (object) []],
        ];
    }
}
