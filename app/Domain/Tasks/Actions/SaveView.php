<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\SavedViewLayout;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;

/**
 * Creates or updates a saved view (filters + layout) of a workspace — or, with
 * no workspace, a personal cross-workspace view of "Tugas saya" (the mobile
 * app; docs/DATABASE.md §4 saved_views.workspace_id null).
 * `filters` is normalized to the shape of resources/js/features/tasks/lib/filters.ts
 * (`assignees` may contain "me" and "none"); the cross-workspace keys
 * `workspaces`, `statuses`, `due_from` and `due_to` are kept only when given.
 */
final class SaveView
{
    /**
     * @param  array{name: string, layout: SavedViewLayout|string, filters?: array<string, mixed>, sort?: array<string, mixed>|null, is_shared?: bool}  $data
     */
    public function handle(User $user, ?Workspace $workspace, array $data, ?SavedView $view = null): SavedView
    {
        $view ??= new SavedView(['user_id' => $user->id, 'workspace_id' => $workspace?->id]);

        $view->fill([
            'name' => trim($data['name']),
            'layout' => $data['layout'] instanceof SavedViewLayout ? $data['layout'] : SavedViewLayout::from($data['layout']),
            'filters' => self::normalizeFilters($data['filters'] ?? []),
            'sort' => $data['sort'] ?? null,
            'is_shared' => $data['is_shared'] ?? false,
        ])->save();

        return $view;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{assignees: list<string>, priorities: list<int>, labels: list<string>, due: string|null, q: string, workspaces?: list<string>, statuses?: list<string>, due_from?: string, due_to?: string}
     */
    public static function normalizeFilters(array $filters): array
    {
        $strings = fn (mixed $value): array => is_array($value)
            ? array_values(array_unique(array_filter($value, fn (mixed $item): bool => is_string($item) && $item !== '')))
            : [];

        $priorities = is_array($filters['priorities'] ?? null)
            ? array_values(array_unique(array_filter(array_map(
                fn (mixed $item): ?int => is_numeric($item) ? (int) $item : null,
                $filters['priorities'],
            ), fn (?int $item): bool => $item !== null && $item >= 0 && $item <= 4)))
            : [];

        $due = $filters['due'] ?? null;

        $normalized = [
            'assignees' => $strings($filters['assignees'] ?? null),
            'priorities' => $priorities,
            'labels' => $strings($filters['labels'] ?? null),
            'due' => is_string($due) && in_array($due, ['overdue', 'today', 'week', 'none'], true) ? $due : null,
            'q' => is_string($filters['q'] ?? null) ? mb_substr(trim($filters['q']), 0, 200) : '',
        ];

        // Cross-workspace ("Tugas saya") keys: absent unless sent, so the
        // workspace views keep exactly their historical shape.
        if (array_key_exists('workspaces', $filters)) {
            $normalized['workspaces'] = $strings($filters['workspaces']);
        }

        if (array_key_exists('statuses', $filters)) {
            $normalized['statuses'] = $strings($filters['statuses']);
        }

        foreach (['due_from', 'due_to'] as $key) {
            if (isset($filters[$key]) && is_string($filters[$key]) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $filters[$key]) === 1) {
                $normalized[$key] = $filters[$key];
            }
        }

        return $normalized;
    }
}
