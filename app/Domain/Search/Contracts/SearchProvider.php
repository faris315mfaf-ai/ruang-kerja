<?php

namespace App\Domain\Search\Contracts;

use App\Domain\Search\Data\SearchResult;
use App\Models\User;

/**
 * One result group of the command palette / mobile search
 * (Aksi · Tugas · Orang · Workspace · Dokumen).
 *
 * Register the class in config/search.php → providers (group order).
 * A provider MUST only return records the viewer may see (use the model's
 * visibleTo($viewer) scope / Policy) — the search endpoint does no other
 * filtering. See docs/sprints/sprint-8/HOW-TO-NOTIFY.md § Pencarian.
 */
interface SearchProvider
{
    /**
     * Stable group key used by the frontend filter chips: actions, tasks, people, workspaces, documents.
     */
    public function key(): string;

    /**
     * Group heading in Indonesian ("Tugas").
     */
    public function label(): string;

    /**
     * Shortest query this provider answers; 0 = also on an empty query.
     */
    public function minQueryLength(): int;

    /**
     * @return list<SearchResult>
     */
    public function search(User $viewer, string $query, int $limit): array;
}
