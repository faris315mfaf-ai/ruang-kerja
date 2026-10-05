<?php

namespace App\Http\Resources;

use App\Models\SavedView;
use App\Models\User;

/**
 * Saved view for the toolbar menu (resources/js/features/tasks/types.ts `SavedView`).
 * Eager-load `user:id,name` for shared views of others.
 */
final class SavedViewResource
{
    /**
     * @return array{id: string, name: string, layout: string, filters: array<string, mixed>, is_shared: bool, mine: bool, owner: string|null}
     */
    public static function from(SavedView $view, User $viewer): array
    {
        $mine = $view->user_id === $viewer->id;

        return [
            'id' => $view->id,
            'name' => $view->name,
            'layout' => $view->layout->value,
            'filters' => $view->filters,
            'is_shared' => $view->is_shared,
            'mine' => $mine,
            'owner' => $mine ? null : ($view->relationLoaded('user') ? $view->user->name : null),
        ];
    }
}
