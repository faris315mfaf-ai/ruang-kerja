<?php

namespace App\Domain\Search\Providers;

use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Workspace" (Sprint 5): workspaces the viewer may see (Workspace::visibleTo),
 * by name or key.
 */
final class WorkspaceSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'workspaces';
    }

    public function label(): string
    {
        return 'Workspace';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        $pattern = LikePattern::contains($query);

        $workspaces = Workspace::query()
            ->visibleTo($viewer)
            ->where(fn (Builder $scope) => $scope
                ->where('workspaces.name', 'ilike', $pattern)
                ->orWhere('workspaces.key', 'ilike', $pattern))
            ->orderByRaw('workspaces.archived_at IS NOT NULL')
            ->orderBy('workspaces.name')
            ->limit($limit)
            ->get();

        $results = [];

        foreach ($workspaces as $workspace) {
            $results[] = new SearchResult(
                id: 'workspace:'.$workspace->id,
                title: $workspace->isPersonal() ? 'Pribadi' : $workspace->name,
                icon: $workspace->type === WorkspaceType::Team || $workspace->type === WorkspaceType::Division ? 'users' : 'layout-grid',
                url: '/w/'.$workspace->key,
                code: $workspace->key,
                subtitle: $workspace->type->label().($workspace->isArchived() ? ' · diarsipkan' : ''),
            );
        }

        return $results;
    }
}
